import { readFile, writeFile } from 'fs/promises';
import { parseOlimpiada } from './olimpiada.js';
import { parsePervye } from './pervye.js';
import { parsePervye as parseSirius } from './sirius.js';

const DATA_PATH = new URL('../../data/opportunities.json', import.meta.url);

export async function syncAll() {
    console.log('🔄 Начинаю синхронизацию с внешними источниками...');

    const current = JSON.parse(await readFile(DATA_PATH, 'utf-8'));
    const existingTitles = new Set(current.map(o => o.title.toLowerCase()));

    const [fromOlimpiada, fromPervye, fromSirius] = await Promise.all([
        parseOlimpiada(),
        parsePervye(),
        parseSirius(),
    ]);

    const fresh = [...fromOlimpiada, ...fromPervye, ...fromSirius]
        .filter(o => !existingTitles.has(o.title.toLowerCase()));

    if (fresh.length === 0) {
        console.log('✅ Новых записей нет. База актуальна.');
        return { added: 0, total: current.length };
    }

    const updated = [...current, ...fresh];
    await writeFile(DATA_PATH, JSON.stringify(updated, null, 2), 'utf-8');

    console.log(`✅ Добавлено ${fresh.length} новых. Всего: ${updated.length}`);
    return { added: fresh.length, total: updated.length };
}