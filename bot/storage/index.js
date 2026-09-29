/**
 * JSON-хранилище для профилей пользователей.
 *
 * Что сохраняется в data/userdata.json:
 *   - favorites:      { chatId: [ { id, title, deadline, link } ] }
 *   - subscriptions:  { chatId: [ "IT", "наука" ] }
 *   - likedOpIds:     { chatId: [ opId, opId ] }
 *   - dislikedOpIds:  { chatId: [ opId ] }
 *   - notifiedIds:    { chatId: [ opId ] }
 *
 * Зачем: чтобы избранное и подписки сохранялись между перезапусками бота.
 *
 * ⚠️ В production-версии планируется переход на PostgreSQL или SQLite
 * для поддержки высокой нагрузки и транзакций.
 */

import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STORAGE_PATH = path.join(__dirname, '..', '..', 'data', 'userdata.json');

console.log('💾 Путь к хранилищу:', STORAGE_PATH);

// Кэш в памяти — для быстрого доступа
let cache = {
    favorites: {},
    subscriptions: {},
    likedOpIds: {},
    dislikedOpIds: {},
    notifiedIds: {}
};

// Флаг, что данные загружены
let isLoaded = false;

// Защита от одновременной записи
let writeInProgress = false;
let writePending = false;

/**
 * Загружает данные из JSON-файла.
 * Вызывается один раз при старте бота.
 */
export async function loadStorage() {
    try {
        if (!existsSync(STORAGE_PATH)) {
            console.log('💾 Хранилище: файл не найден, создаю новый');
            await saveStorage();
            isLoaded = true;
            return;
        }

        const raw = await readFile(STORAGE_PATH, 'utf-8');
        const parsed = JSON.parse(raw);

        cache = {
            favorites: parsed.favorites || {},
            subscriptions: parsed.subscriptions || {},
            likedOpIds: parsed.likedOpIds || {},
            dislikedOpIds: parsed.dislikedOpIds || {},
            notifiedIds: parsed.notifiedIds || {}
        };

        const totalUsers = Object.keys(cache.favorites).length;
        const totalFavs = Object.values(cache.favorites).reduce((s, l) => s + l.length, 0);
        const totalSubs = Object.keys(cache.subscriptions).length;

        console.log(`💾 Хранилище загружено: ${totalUsers} пользователей, ${totalFavs} избранных, ${totalSubs} подписок`);
        isLoaded = true;
    } catch (error) {
        console.error('❌ Ошибка загрузки хранилища:', error.message);
        console.error('⚠️ Стартуем с пустым хранилищем');
        isLoaded = true;
    }
}

/**
 * Сохраняет данные в JSON-файл.
 * Защита от одновременных записей: если запись уже идёт — ставим флаг pending.
 */
export async function saveStorage() {
    if (writeInProgress) {
        writePending = true;
        return;
    }

    writeInProgress = true;

    try {
        const raw = JSON.stringify(cache, null, 2);
        await writeFile(STORAGE_PATH, raw, 'utf-8');
    } catch (error) {
        console.error('❌ Ошибка сохранения хранилища:', error.message);
    } finally {
        writeInProgress = false;

        if (writePending) {
            writePending = false;
            await saveStorage(); // рекурсивно повторяем
        }
    }
}

// =================== API для работы с избранным ===================

export function getFavorites(chatId) {
    return cache.favorites[String(chatId)] || [];
}

export function setFavorites(chatId, list) {
    cache.favorites[String(chatId)] = list;
    saveStorage().catch(e => console.error('saveStorage error:', e));
}

// =================== API для работы с подписками ===================

export function getSubscriptions(chatId) {
    const arr = cache.subscriptions[String(chatId)] || [];
    return new Set(arr);
}

export function setSubscriptions(chatId, set) {
    cache.subscriptions[String(chatId)] = [...set];
    saveStorage().catch(e => console.error('saveStorage error:', e));
}

// =================== API для реакций ===================

export function getLiked(chatId) {
    const arr = cache.likedOpIds[String(chatId)] || [];
    return new Set(arr);
}

export function setLiked(chatId, set) {
    cache.likedOpIds[String(chatId)] = [...set];
    saveStorage().catch(e => console.error('saveStorage error:', e));
}

export function getDisliked(chatId) {
    const arr = cache.dislikedOpIds[String(chatId)] || [];
    return new Set(arr);
}

export function setDisliked(chatId, set) {
    cache.dislikedOpIds[String(chatId)] = [...set];
    saveStorage().catch(e => console.error('saveStorage error:', e));
}

// =================== API для notified ===================

export function getNotified(chatId) {
    const arr = cache.notifiedIds[String(chatId)] || [];
    return new Set(arr);
}

export function setNotified(chatId, set) {
    cache.notifiedIds[String(chatId)] = [...set];
    saveStorage().catch(e => console.error('saveStorage error:', e));
}

// =================== Общая статистика ===================

export function getStorageStats() {
    return {
        totalUsers: Object.keys(cache.favorites).length,
        totalFavorites: Object.values(cache.favorites).reduce((s, l) => s + l.length, 0),
        totalSubscriptions: Object.keys(cache.subscriptions).length,
        totalLikes: Object.values(cache.likedOpIds).reduce((s, l) => s + l.length, 0),
        totalDislikes: Object.values(cache.dislikedOpIds).reduce((s, l) => s + l.length, 0)
    };
}

// =================== Итерация ===================

export function getFavoritesEntries() {
    return Object.entries(cache.favorites);
}

export function getSubscriptionsEntries() {
    return Object.entries(cache.subscriptions).map(([k, v]) => [k, new Set(v)]);
}