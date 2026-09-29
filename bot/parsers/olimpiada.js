import axios from 'axios';
import * as cheerio from 'cheerio';

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (compatible; TraektoriaBot/1.0; educational)'
};

// Определяем интересы по ключевым словам в названии
function detectInterests(title) {
    const t = title.toLowerCase();
    const interests = [];
    if (t.includes('информат') || t.includes('программ') || t.includes('IT') ||
        t.includes('компьютер') || t.includes('робот') || t.includes('код')) interests.push('IT');
    if (t.includes('матем')) interests.push('математика');
    if (t.includes('физик') || t.includes('хим') || t.includes('биолог') ||
        t.includes('эколог') || t.includes('географ') || t.includes('астроном')) interests.push('наука');
    if (t.includes('инженер') || t.includes('техн') || t.includes('авиа')) interests.push('инженерия');
    if (t.includes('медиц') || t.includes('биолог')) interests.push('медицина');
    if (t.includes('эконом') || t.includes('финанс') || t.includes('бизнес')) interests.push('бизнес');
    if (t.includes('искусств') || t.includes('литератур') || t.includes('дизайн') ||
        t.includes('музык') || t.includes('рисун')) interests.push('искусство');
    if (interests.length === 0) interests.push('наука'); // по умолчанию
    return interests;
}

// Определяем возраст по названию
function detectGrade(title) {
    const t = title.toLowerCase();
    if (t.includes('дошколь') || t.includes('5-7') || t.includes('младш')) return ['5-7'];
    if (t.includes('студент') || t.includes('вуз')) return ['студент-вуз', 'студент-спо'];
    // По умолчанию — все
    return ['5-7', '8-9', '10-11'];
}

async function parsePage(url) {
    const { data } = await axios.get(url, { timeout: 15000, headers: HEADERS });
    const $ = cheerio.load(data);
    const events = [];

    $('div.block_inner a, a.black, a.none.black').each((i, el) => {
        const link = $(el).attr('href');
        const title = $(el).find('.headline').text().trim()
                   || $(el).find('span').text().trim()
                   || $(el).text().trim();

        if (title && link && title.length > 10 && title.length < 200) {
            events.push({
                id: `olimp-${Date.now()}-${i}`,
                title,
                type: 'олимпиада',
                grade: detectGrade(title),
                federal_district: 'Россия',
                city: 'Разные города',
                format: 'гибрид',
                interests: detectInterests(title),
                deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                    .toISOString().slice(0, 10),
                link: link.startsWith('http') ? link : `https://olimpiada.ru${link}`,
                source: 'Olimpiada.ru (парсинг)',
                is_all_russian: true,
            });
        }
    });

    return events;
}

export async function parseOlimpiada() {
    try {
        const urls = ['https://olimpiada.ru/activities'];
        const all = [];
        for (const url of urls) {
            try {
                const items = await parsePage(url);
                all.push(...items);
                console.log(`✅ ${url}: ${items.length}`);
            } catch (e) {
                console.warn(`⚠️ ${url}: ${e.message}`);
            }
        }

        const unique = Array.from(
            new Map(all.map(e => [e.title, e])).values()
        ).slice(0, 60);

        console.log(`✅ olimpiada.ru: итого найдено ${unique.length}`);
        return unique;
    } catch (error) {
        console.error('❌ Ошибка парсинга olimpiada.ru:', error.message);
        return [];
    }
}