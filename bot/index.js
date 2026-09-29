import 'dotenv/config';
import { getRegionByDistrict, getPilotRegions } from './config/regions.js';
import { getPartnersByRegion } from './config/partners.js';
import { formatScalingReport, formatRoadmap, isAdmin } from './admin/index.js';
import axios from 'axios';
import { readFile } from 'fs/promises';
import { recommendWithGigaChat } from './gigachat.js';
import cron from 'node-cron';
import { syncAll } from './parsers/index.js';

const TOKEN = process.env.MAX_BOT_TOKEN;
if (!TOKEN) {
    console.error('❌ MAX_BOT_TOKEN не найден в .env');
    process.exit(1);
}

const API_URL = 'https://platform-api2.max.ru';
const api = axios.create({
    baseURL: API_URL,
    headers: { 'Authorization': TOKEN }
});

// Загружаем данные о возможностях
let opportunities = [];
try {
    const raw = await readFile(new URL('../data/opportunities.json', import.meta.url), 'utf-8');
    opportunities = JSON.parse(raw);
    console.log(`📚 Загружено ${opportunities.length} мероприятий из базы`);
} catch (error) {
    console.error('❌ Ошибка загрузки базы данных:', error.message);
    console.error('⚠️ Бот запустится с пустой базой. Проверьте data/opportunities.json');
    opportunities = [];
}

import { loadStorage, getFavorites, setFavorites,
         getSubscriptions, setSubscriptions,
         getLiked, setLiked, getDisliked, setDisliked,
         getNotified, setNotified, getStorageStats,
         getFavoritesEntries, getSubscriptionsEntries } from './storage/index.js';

// Состояние диалога — оставляем в памяти (сбрасывается при перезапуске)
const userStates = new Map();  // { chatId: { step, grade, region, interest } }
// Загружаем хранилище один раз при старте
await loadStorage();

// =================== UI: клавиатуры ===================

function keyboardGrade() {
    return {
        type: 'inline_keyboard',
        payload: {
            buttons: [
                [{ type: 'callback', text: '🎒 5-7 класс', payload: 'grade:5-7' }],
                [{ type: 'callback', text: '📚 8-9 класс', payload: 'grade:8-9' }],
                [{ type: 'callback', text: '🎓 10-11 класс', payload: 'grade:10-11' }],
                [{ type: 'callback', text: '🏫 Студент колледжа (СПО)', payload: 'grade:студент-спо' }],
                [{ type: 'callback', text: '🎓 Студент вуза', payload: 'grade:студент-вуз' }]
            ]
        }
    };
}

function keyboardRegion() {
    return {
        type: 'inline_keyboard',
        payload: {
            buttons: [
                [{ type: 'callback', text: '🏛️ Центральный ФО (ЦФО)', payload: 'region:ЦФО' }],
                [{ type: 'callback', text: '🌊 Северо-Западный ФО (СЗФО)', payload: 'region:СЗФО' }],
                [{ type: 'callback', text: '☀️ Южный ФО (ЮФО)', payload: 'region:ЮФО' }],
                [{ type: 'callback', text: '🏔️ Северо-Кавказский ФО (СКФО)', payload: 'region:СКФО' }],
                [{ type: 'callback', text: '🌾 Приволжский ФО (ПФО)', payload: 'region:ПФО' }],
                [{ type: 'callback', text: '⛰️ Уральский ФО (УФО)', payload: 'region:УФО' }],
                [{ type: 'callback', text: '🌲 Сибирский ФО (СФО)', payload: 'region:СФО' }],
                [{ type: 'callback', text: '🐅 Дальневосточный ФО (ДФО)', payload: 'region:ДФО' }],
                [{ type: 'callback', text: '🇷🇺 Вся Россия', payload: 'region:Россия' }]
            ]
        }
    };
}

function keyboardInterests() {
    return {
        type: 'inline_keyboard',
        payload: {
            buttons: [
                [{ type: 'callback', text: '💻 IT', payload: 'interest:IT' }],
                [{ type: 'callback', text: '🔬 Наука', payload: 'interest:наука' }],
                [{ type: 'callback', text: '⚙️ Инженерия', payload: 'interest:инженерия' }],
                [{ type: 'callback', text: '🎨 Искусство', payload: 'interest:искусство' }],
                [{ type: 'callback', text: '🩺 Медицина', payload: 'interest:медицина' }],
                [{ type: 'callback', text: '💼 Бизнес', payload: 'interest:бизнес' }]
            ]
        }
    };
}

function keyboardAfterResult() {
    return {
        type: 'inline_keyboard',
        payload: {
            buttons: [
                [{ type: 'callback', text: '🔁 Ещё подборку', payload: 'action:more' }],
                [{ type: 'callback', text: '👤 Мой профиль', payload: 'menu:profile' }],
                [{ type: 'callback', text: '🔄 Начать заново', payload: 'action:reset' }]
            ]
        }
    };
}

function keyboardForOpportunity(opId) {
    return {
        type: 'inline_keyboard',
        payload: {
            buttons: [
                [{ type: 'callback', text: '⭐ В избранное', payload: `fav:${opId}` }],
                [{ type: 'callback', text: '🔗 Открыть', payload: `open:${opId}` }],
                [{ type: 'callback', text: '📤 Поделиться', payload: `share:${opId}` }],
                [
                    { type: 'callback', text: '👍 Полезно', payload: `like:${opId}` },
                    { type: 'callback', text: '👎 Не интересно', payload: `dislike:${opId}` }
                ]
            ]
        }
    };
}

function keyboardMainMenu() {
    return {
        type: 'inline_keyboard',
        payload: {
            buttons: [
                [{ type: 'callback', text: '🔍 Найти возможности', payload: 'menu:search' }],
                [{ type: 'callback', text: '📅 Мои дедлайны', payload: 'menu:deadlines' }],
                [{ type: 'callback', text: '🧠 Спросить GigaChat', payload: 'menu:giga' }],
                [{ type: 'callback', text: '👤 Мой профиль', payload: 'menu:profile' }],
                [{ type: 'callback', text: '🔔 Подписки', payload: 'menu:subscribe' }],
                [{ type: 'callback', text: '🏠 Старт', payload: 'menu:home' }]
            ]
        }
    };
}

function keyboardSubscribe(activeInterests = new Set()) {
    const all = ['IT', 'наука', 'инженерия', 'искусство', 'медицина', 'бизнес'];
    const buttons = all.map(interest => {
        const mark = activeInterests.has(interest) ? '✅' : '⬜';
        return [{
            type: 'callback',
            text: `${mark} ${interest}`,
            payload: `sub:${interest}`
        }];
    });
    buttons.push([{ type: 'callback', text: '✔️ Готово', payload: 'sub:done' }]);
    return {
        type: 'inline_keyboard',
        payload: { buttons }
    };
}
// =================== Отправка сообщений ===================

async function sendMessage(chatId, text, keyboard = null, retries = 3) {
    const body = { text };
    if (keyboard) body.attachments = [keyboard];

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            await api.post('/messages', body, { params: { chat_id: chatId } });
            console.log(`✅ Отправлено в чат ${chatId}: ${text.slice(0, 40)}...`);
            return true;
        } catch (error) {
            const status = error.response?.status;
            const isRetryable = !status || status >= 500 || status === 429;

            console.error(`❌ Попытка ${attempt}/${retries} не удалась:`,
                error.response?.status || error.code || 'network error');

            if (!isRetryable || attempt === retries) {
                return false;
            }

            // Экспоненциальная пауза: 1с, 2с, 4с
            await new Promise(r => setTimeout(r, 1000 * attempt));
        }
    }
}

// =================== Логика подбора ===================

function pickOpportunities({ grade, region, interest, chatId = null }) {
    // Отфильтрованные («👎») ID — исключаем из выдачи
    const disliked = chatId ? getDisliked(chatId) : new Set();
    const liked = chatId ? getLiked(chatId) : new Set();

    const filtered = opportunities.filter(o => {
        if (disliked.has(o.id)) return false;
        if (!o.grade.includes(grade)) return false;
        if (!o.interests.includes(interest)) return false;

        if (region === 'Россия') return true;
        return o.federal_district === region || o.is_all_russian === true;
    });

    // Сортируем: сначала с высоким приоритетом (совпадение по интересам с liked),
    // затем по дате дедлайна
    return filtered
        .map(o => {
            // Приоритет: если мероприятие похоже на «понравившееся» (пересекаются интересы)
            const likedSimilarity = [...liked].some(id => {
                const likedOp = opportunities.find(x => x.id === id);
                return likedOp && likedOp.interests.some(i => o.interests.includes(i));
            }) ? 1 : 0;
            return { op: o, likedSimilarity };
        })
        .sort((a, b) => {
            if (b.likedSimilarity !== a.likedSimilarity) {
                return b.likedSimilarity - a.likedSimilarity;
            }
            return new Date(a.op.deadline) - new Date(b.op.deadline);
        })
        .slice(0, 5)
        .map(item => item.op);
}

// =================== Long Polling ===================
// Склонение слова «возможность»
function pluralizeOpportunities(n) {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return 'возможность';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'возможности';
    return 'возможностей';
}
// =================== Напоминания о дедлайнах ===================

async function checkDeadlines() {
    const today = new Date();
    const in3days = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);

    if (getStorageStats().totalUsers === 0) {
        console.log('⏱️ Проверка дедлайнов: избранное пусто');
        return;
    }

    for (const [chatId, list] of getFavoritesEntries()) {
        for (const fav of list) {
            const dl = new Date(fav.deadline);
            if (dl.toDateString() === in3days.toDateString()) {
                await sendMessage(chatId,
                    `⏰ Напоминание: через 3 дня дедлайн у «${fav.title}»!\n` +
                    `📅 ${fav.deadline}\n` +
                    `🔗 ${fav.link}`
                );
            }
        }
    }
    console.log('⏱️ Проверка дедлайнов выполнена');
}

// =================== Личный кабинет ===================

async function showFavorites(chatId) {
    const list = getFavorites(chatId);

    if (list.length === 0) {
        await sendMessage(chatId,
            '📭 *Твой профиль пуст.*\n\n' +
            'Пока ты не добавил ни одной возможности в избранное. ' +
            'Найди что-то интересное через кнопку «🔍 Найти возможности» и нажми ⭐.',
            keyboardMainMenu()
        );
        return;
    }

    await sendMessage(chatId, `👤 *Мой профиль*\n\n⭐ Сохранённых возможностей: *${list.length}*\n\nНиже — твой список:`);

    for (const fav of list) {
        const text = `📌 ${fav.title}\n` +
                     `📅 Дедлайн: ${fav.deadline}\n` +
                     `🔗 ${fav.link}`;
        const kb = {
            type: 'inline_keyboard',
            payload: {
                buttons: [
                    [{ type: 'callback', text: '🔗 Открыть', payload: `open:${fav.id}` }],
                    [{ type: 'callback', text: '🗑️ Удалить', payload: `unfav:${fav.id}` }]
                ]
            }
        };
        await sendMessage(chatId, text, kb);
    }

    await sendMessage(chatId, 'Что дальше?', keyboardMainMenu());
}

// =================== Мои дедлайны ===================

async function showDeadlines(chatId) {
    const list = getFavorites(chatId);

    if (list.length === 0) {
        await sendMessage(chatId,
            '📅 *Мои дедлайны пусты.*\n\n' +
            'Добавь мероприятия в ⭐ избранное — и я покажу твои ближайшие дедлайны.',
            keyboardMainMenu()
        );
        return;
    }

    // Сортируем по дате
    const sorted = [...list].sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const lines = sorted.map(fav => {
        const dl = new Date(fav.deadline);
        const diffDays = Math.ceil((dl - today) / (1000 * 60 * 60 * 24));

        let icon;
        if (diffDays < 0) icon = '⚫';        // просрочено
        else if (diffDays <= 7) icon = '🔴';  // срочно
        else if (diffDays <= 30) icon = '🟡'; // скоро
        else icon = '🟢';                     // есть время

        return `${icon} *${fav.title}*\n   📅 ${fav.deadline} — ${
            diffDays < 0 ? `просрочено на ${-diffDays} дн.` :
            diffDays === 0 ? 'сегодня последний день!' :
            diffDays === 1 ? 'остался 1 день' :
            `осталось ${diffDays} дней`
        }`;
    }).join('\n\n');

    await sendMessage(chatId,
        `📅 *Мои дедлайны* (${list.length})\n\n${lines}\n\n` +
        '🔴 — до 7 дней, 🟡 — до 30 дней, 🟢 — больше 30 дней, ⚫ — просрочено',
        keyboardMainMenu()
    );
}
// =================== Подписки ===================

async function showSubscriptions(chatId) {
    const subs = getSubscriptions(chatId);

    if (subs.size === 0) {
        await sendMessage(chatId,
            '🔔 *У тебя пока нет подписок.*\n\n' +
            'Выбери направления — и я буду присылать новые мероприятия по ним 👇',
            keyboardSubscribe()
        );
        return;
    }

    const list = [...subs].map(s => `• ${s}`).join('\n');
    await sendMessage(chatId,
        `🔔 *Твои подписки:*\n\n${list}\n\n` +
        'Нажми на интерес, чтобы включить или выключить его 👇',
        keyboardSubscribe(subs)
    );
}

async function checkNewOpportunities() {
    const subsEntries = getSubscriptionsEntries();
    if (subsEntries.length === 0) {
        console.log('🔔 Проверка новых: подписок нет');
        return;
    }

    for (const [chatId, interests] of subsEntries) {
        const seen = getNotified(chatId);

        // Ищем мероприятия по интересам пользователя, которые ещё не отправляли
        const fresh = opportunities.filter(o =>
            o.interests.some(i => interests.has(i)) && !seen.has(o.id)
        );

        if (fresh.length === 0) continue;

        // Отправляем не больше 2 за одну проверку, чтобы не спамить
        const toSend = fresh.slice(0, 2);

        for (const op of toSend) {
            await sendMessage(chatId,
                `🆕 *Новое по твоим подпискам!*\n\n` +
                `📌 ${op.title}\n` +
                `🏷️ ${op.type}\n` +
                `📍 ${op.city} (${op.federal_district})\n` +
                `📅 Дедлайн: ${op.deadline}\n` +
                `🔗 ${op.link}`
            );
            seen.add(op.id);
        }

        setNotified(chatId, seen);
        console.log(`🔔 Отправлено ${toSend.length} новых в чат ${chatId}`);
    }
}
// =================== Обработчики событий ===================

async function handleBotStarted(update) {
    const chatId = update.chat_id;
    const payload = update.payload;  // диплинк-параметр

    // Если пришли по ссылке «Поделиться»
    if (payload && payload.startsWith('op_')) {
        const opId = payload.replace('op_', '');
        const op = opportunities.find(o => o.id === opId);

        if (op) {
            userStates.set(chatId, { step: 'grade' });
            await sendMessage(chatId, '👋 Привет! Тебе передали мероприятие:');
            const formatIcon = op.format === 'онлайн' ? '🌐' : (op.format === 'оффлайн' ? '🏛️' : '🔀');
            const locationText = op.is_all_russian
                ? 'Вся Россия'
                : `${op.city} (${op.federal_district})`;

            const text = `📌 ${op.title}\n` +
                         `🏷️ ${op.type}\n` +
                         `📍 ${locationText} • ${formatIcon} ${op.format}\n` +
                         `🎯 ${op.interests.join(', ')}\n` +
                         `📅 Дедлайн: ${op.deadline}\n` +
                         `ℹ️ Источник: ${op.source}`;

            await sendMessage(chatId, text, keyboardForOpportunity(op.id));
            await sendMessage(chatId, 'Что дальше?', keyboardMainMenu());
            return;
        }
    }

    // Обычный запуск
    userStates.set(chatId, { step: 'grade' });
    await sendMessage(chatId, '⏳ Загружаю...');
    await new Promise(r => setTimeout(r, 700));

    await sendMessage(chatId,
        '👋 Привет! Я — «Траектория»\n\n' +
        'Я — твой навигатор в мире образовательных возможностей:\n\n' +
        '🎓 Олимпиады и конкурсы\n' +
        '📚 Курсы и кружки\n' +
        '💼 Стажировки и дни открытых дверей\n' +
        '🏆 Конференции и проекты\n\n' +
        'Всё — по возрасту, региону и интересам.\n\n' +
        'Выбери, что сделать:',
        keyboardMainMenu()
    );
}

async function handleMessage(update) {
    const chatId = update.message?.recipient?.chat_id;
    const text = (update.message?.body?.text || '').trim();

    if (!chatId || !text) return;

    if (text === '/start') {
        userStates.set(chatId, { step: 'grade' });
        await sendMessage(chatId, '⏳ Загружаю...');
        await new Promise(r => setTimeout(r, 500));
        await sendMessage(chatId,
            '👋 Привет! Я — «Траектория»\n\n' +
            'Твой навигатор в мире образовательных возможностей:\n' +
            '🎓 олимпиады, 📚 курсы, 💼 стажировки, 🏆 конкурсы.\n\n' +
            'Подберу подходящее по возрасту, региону и интересам.\n\n' +
            '🎯 Давай подберем что-нибудь для тебя?',
            keyboardMainMenu()
        );
        return;
    }

    if (text === '/stats') {
        if (!isAdmin(chatId)) {
            await sendMessage(chatId, '⛔ Команда доступна только администраторам.');
            return;
        }

        const storageStats = getStorageStats();
        const totalUsers = userStates.size;
        const usersWithFavorites = storageStats.totalUsers;
        const usersWithSubs = storageStats.totalSubscriptions;
        const totalFavorites = storageStats.totalFavorites;

        await sendMessage(chatId,
            `📊 *Статистика бота*\n\n` +
            `👥 Пользователей: *${totalUsers}*\n` +
            `⭐ С избранным: *${usersWithFavorites}*\n` +
            `🔔 С подписками: *${usersWithSubs}*\n` +
            `📌 Всего сохранено: *${totalFavorites}*\n` +
            `📚 Мероприятий в базе: *${opportunities.length}*\n\n` +
            `_Данные актуальны на момент запроса_`,
            keyboardMainMenu()
        );
        return;
    }

    if (text === '/scaling') {
        if (!isAdmin(chatId)) {
            await sendMessage(chatId, '⛔ Команда доступна только администраторам.');
            return;
        }
        await sendMessage(chatId, formatScalingReport(), keyboardMainMenu());
        return;
    }

    if (text === '/roadmap') {
         if (!isAdmin(chatId)) {
            await sendMessage(chatId, '⛔ Команда доступна только администраторам.');
            return;
         }
         await sendMessage(chatId,
            `🗺️ *Roadmap внедрения*\n\n${formatRoadmap()}`,
            keyboardMainMenu()
         );
         return;
    }

    if (text === '/partners') {
        if (!isAdmin(chatId)) {
            await sendMessage(chatId, '⛔ Команда доступна только администраторам.');
            return;
        }
        const pilots = getPilotRegions();
        const lines = pilots.map(p =>
            `📍 *${p.name}*\n${p.partners.map(x => `• ${x}`).join('\n')}`
        ).join('\n\n');
        await sendMessage(chatId,
            `🤝 *Партнёры по регионам*\n\n${lines}`,
            keyboardMainMenu()
        );
        return;
    }

    if (text === '/profile') {
        await showFavorites(chatId);
        return;
    }

    if (text === '/subscribe') {
        await showSubscriptions(chatId);
        return;
    }

    if (text === '/ask' || text.startsWith('/ask ')) {
    const query = text.replace('/ask', '').trim();
        if (!query) {
            await sendMessage(chatId,
                '💬 *Задай вопрос GigaChat!*\n\n' +
                'Например:\n' +
                '• `/ask Подбери олимпиады по IT для 11 класса`\n' +
                '• `/ask Что интересного для 8 класса по науке?`'
            );
            return;
        }

        await sendMessage(chatId, '🤔 Думаю...');
        const answer = await recommendWithGigaChat(query, opportunities);

        if (!answer || answer.startsWith('⚠️') || answer.length < 10) {
            // Fallback: GigaChat недоступен — предлагаем обычный поиск
            await sendMessage(chatId,
                '🧠 GigaChat временно недоступен, но я могу помочь иначе!\n\n' +
                'Давай подберу возможности через обычный поиск — по возрасту, региону и интересам.',
                {
                    type: 'inline_keyboard',
                    payload: {
                        buttons: [
                            [{ type: 'callback', text: '🔍 Найти возможности', payload: 'menu:search' }],
                            [{ type: 'callback', text: '🏠 В меню', payload: 'menu:home' }]
                        ]
                    }
                }
            );
        } else {
            await sendMessage(chatId, `💡 *Рекомендация GigaChat:*\n\n${answer}`, keyboardMainMenu());
        }
        return;
    }

        // Если пользователь в режиме вопроса к GigaChat — любой текст идёт в ИИ
    const currentState = userStates.get(chatId);
    if (currentState && currentState.step === 'ask_question') {
        await sendMessage(chatId, '🤔 Думаю...');
        const answer = await recommendWithGigaChat(text, opportunities);
        userStates.set(chatId, { step: 'grade' });

        if (!answer || answer.startsWith('⚠️') || answer.length < 10) {
            await sendMessage(chatId,
                '🧠 GigaChat временно недоступен. Попробуй обычный поиск 👇',
                {
                    type: 'inline_keyboard',
                    payload: {
                        buttons: [
                            [{ type: 'callback', text: '🔍 Найти возможности', payload: 'menu:search' }],
                            [{ type: 'callback', text: '🏠 В меню', payload: 'menu:home' }]
                        ]
                    }
                }
            );
        } else {
            await sendMessage(chatId, `💡 *Рекомендация GigaChat:*\n\n${answer}`, keyboardMainMenu());
        }
        return;
    }

    if (!userStates.has(chatId)) {
        userStates.set(chatId, { step: 'grade' });
        await sendMessage(chatId, 'Давай начнём сначала. Подскажи свою возрастную категорию?', keyboardGrade());
        return;
    }

    await sendMessage(chatId, 'Пожалуйста, выбери один из вариантов на клавиатуре 🙂');
}

async function handleCallback(update) {
    const chatId = update.message?.recipient?.chat_id;
    const payload = update.callback?.payload;

    if (!chatId || !payload) return;

    const [key, value] = payload.split(':');
    const state = userStates.get(chatId) || {};

    console.log(`🔘 Нажата кнопка: ${key} = ${value} (chat=${chatId})`);

    if (key === 'grade') {
        state.grade = value;
        state.step = 'region';
        userStates.set(chatId, state);
        await sendMessage(chatId, `Отлично, ${value}. В каком регионе ищешь возможности?`, keyboardRegion());
        return;
    }

    if (key === 'region') {
        state.region = value;
        state.step = 'interest';
        userStates.set(chatId, state);
        await sendMessage(chatId, 'Что тебе интересно?', keyboardInterests());
        return;
    }

        if (key === 'interest') {
        state.interest = value;
        state.step = 'done';
        userStates.set(chatId, state);

        let results = pickOpportunities({
            grade: state.grade,
            region: state.region,
            interest: state.interest,
            chatId  // ← добавлено
        });

        // Если ничего не нашли — показываем альтернативы
        if (results.length === 0) {
            // Попробуем без учёта региона
            const withoutRegion = pickOpportunities({
                grade: state.grade,
                region: 'Россия',
                interest: state.interest,
                chatId  // ← добавлено
            });

            if (withoutRegion.length > 0) {
                await sendMessage(chatId,
                    `В твоём округе по направлению «${state.interest}» пока ничего не нашлось 😔\n\n` +
                    `Но есть возможности по всей России 👇`
                );
                results = withoutRegion;
            } else {
                // Совсем ничего — предлагаем другие интересы
                const allForGrade = opportunities.filter(o =>
                    o.grade.includes(state.grade) && o.federal_district === state.region
                );
                const altInterests = [...new Set(allForGrade.flatMap(o => o.interests))]
                    .filter(i => i !== state.interest)
                    .slice(0, 4);

                if (altInterests.length > 0) {
                    const buttons = altInterests.map(i => [
                        { type: 'callback', text: `🎯 ${i}`, payload: `interest:${i}` }
                    ]);
                    buttons.push([{ type: 'callback', text: '🔄 Начать заново', payload: 'action:reset' }]);

                    await sendMessage(chatId,
                        `К сожалению, по запросу «${state.interest}» в округе ${state.region} сейчас ничего нет 😔\n\n` +
                        `Но у нас есть варианты по другим направлениям:`,
                        { type: 'inline_keyboard', payload: { buttons } }
                    );
                    return;
                }

                await sendMessage(chatId,
                    'К сожалению, по твоим параметрам пока ничего не нашлось 😔\n' +
                    'Попробуй изменить регион или интерес.',
                    keyboardAfterResult()
                );
                return;
            }
        }

        // === ЭТОЙ ЧАСТИ НЕ ХВАТАЛО ===
        const word = pluralizeOpportunities(results.length);
        await sendMessage(chatId, `🎉 Нашёл ${results.length} ${word} для тебя:`);

        for (const op of results) {
            const formatIcon = op.format === 'онлайн' ? '🌐' : (op.format === 'оффлайн' ? '🏛️' : '🔀');
            const locationText = op.is_all_russian
                ? 'Вся Россия'
                : `${op.city} (${op.federal_district})`;

            const text = `📌 ${op.title}\n` +
                         `🏷️ ${op.type}\n` +
                         `📍 ${locationText} • ${formatIcon} ${op.format}\n` +
                         `🎯 ${op.interests.join(', ')}\n` +
                         `📅 Дедлайн: ${op.deadline}\n` +
                         `ℹ️ Источник: ${op.source}`;
            await sendMessage(chatId, text, keyboardForOpportunity(op.id));
        }

        await sendMessage(chatId, 'Что дальше?', keyboardAfterResult());
        return;
    }

    if (key === 'fav') {
        const op = opportunities.find(o => o.id === value);
        if (!op) return;

        const list = getFavorites(chatId);
        if (list.some(item => item.id === op.id)) {
            await sendMessage(chatId, `Уже в избранном: ${op.title}`);
            return;
        }
        list.push({ id: op.id, title: op.title, deadline: op.deadline, link: op.link });
        setFavorites(chatId, list);
        await sendMessage(chatId, `⭐ Добавлено в избранное: ${op.title}\nНапомню за 3 дня до дедлайна (${op.deadline}).`);
        return;
    }

    if (key === 'open') {
        const op = opportunities.find(o => o.id === value);
        if (op) await sendMessage(chatId, `🔗 ${op.link}`);
        return;
    }

    if (key === 'menu') {
        if (value === 'profile') {
            await showFavorites(chatId);
            return;
        }

        if (value === 'deadlines') {
            await showDeadlines(chatId);
            return;
        }

        if (value === 'search') {
            userStates.set(chatId, { step: 'grade' });
            await sendMessage(chatId, 'Выбери свою категорию?', keyboardGrade());
            return;
        }
        if (value === 'subscribe') {
            await showSubscriptions(chatId);
            return;
        }
                if (value === 'giga') {
            userStates.set(chatId, { step: 'ask_question' });
            await sendMessage(chatId,
                '🧠 *Спроси GigaChat*\n\n' +
                'Напиши свой вопрос — и я подберу подходящие мероприятия.\n\n' +
                'Например:\n' +
                '• «Хочу олимпиады по IT для 11 класса»\n' +
                '• «Что интересного по науке для 8 класса?»\n' +
                '• «Куда пойти учиться на дизайнера?»\n\n' +
                '✏️ Просто напиши вопрос в чат 👇',
                {
                    type: 'inline_keyboard',
                    payload: {
                        buttons: [
                            [{ type: 'callback', text: '❌ Отмена', payload: 'menu:home' }]
                        ]
                    }
                }
            );
            return;
        }
        if (value === 'home') {
            userStates.set(chatId, { step: 'grade' });
            await sendMessage(chatId, '⏳ Загружаю...');
            await new Promise(r => setTimeout(r, 400));
            await sendMessage(chatId,
                '👋 Привет! Я — «Траектория»\n\n' +
                'Твой навигатор в мире образовательных возможностей:\n' +
                '🎓 олимпиады, 📚 курсы, 💼 стажировки, 🏆 конкурсы.\n\n' +
                'Выбери, что сделать:',
                keyboardMainMenu()
            );
            return;
        }
    }

    if (key === 'sub') {
        if (value === 'done') {
            const subs = getSubscriptions(chatId);
            if (subs.size === 0) {
                await sendMessage(chatId,
                    'Ты не выбрал ни одного направления. Возвращаю в главное меню.',
                    keyboardMainMenu()
                );
            } else {
                await sendMessage(chatId,
                    `✅ Подписки сохранены: ${[...subs].join(', ')}\n` +
                    'Буду присылать новые мероприятия по этим направлениям.',
                    keyboardMainMenu()
                );
            }
            return;
        }

        // Переключение конкретного интереса
        // Переключение конкретного интереса
        const subs = getSubscriptions(chatId);
        if (subs.has(value)) {
            subs.delete(value);
        } else {
            subs.add(value);
        }
        setSubscriptions(chatId, subs);

        // При первой подписке — «запоминаем» текущие id, чтобы не спамить старым
        const existingNotified = getNotified(chatId);
        if (existingNotified.size === 0) {
            const currentIds = opportunities
                .filter(o => o.interests.some(i => subs.has(i)))
                .map(o => o.id);
            setNotified(chatId, new Set(currentIds));
        }

        await showSubscriptions(chatId);
        return;
    }

    if (key === 'unfav') {
        const list = getFavorites(chatId);
        const idx = list.findIndex(item => item.id === value);
        if (idx === -1) {
            await sendMessage(chatId, 'Не нашёл это мероприятие в избранном.');
            return;
        }
        const removed = list.splice(idx, 1)[0];
        setFavorites(chatId, list);
        await sendMessage(chatId, `🗑️ Удалено из избранного: ${removed.title}`);
        await showFavorites(chatId);
        return;
    }

    if (key === 'share') {
        const op = opportunities.find(o => o.id === value);
        if (!op) return;

        const botName = 't411_hakaton_max_bot';
        const shareLink = `https://max.ru/${botName}?start=op_${op.id}`;

        const shareText =
            `📌 ${op.title}\n` +
            `🏷️ ${op.type} • 📍 ${op.city || 'Вся Россия'}\n` +
            `📅 Дедлайн: ${op.deadline}\n\n` +
            `Открой в боте «Траектория»:\n${shareLink}`;

        await sendMessage(chatId,
            '📤 *Готово!* Скопируй текст ниже и отправь другу в MAX:\n\n' +
            '—————\n' +
            shareText +
            '\n—————\n\n' +
            '_Друг перейдёт по ссылке и увидит это мероприятие в боте._'
        );
        return;
    }

    if (key === 'like') {
        const op = opportunities.find(o => o.id === value);
        if (!op) return;

        const liked = getLiked(chatId);
        const disliked = getDisliked(chatId);

        if (liked.has(value)) {
            liked.delete(value);
            setLiked(chatId, liked);
            await sendMessage(chatId, `Убрал отметку 👍 с «${op.title}»`);
        } else {
            liked.add(value);
            disliked.delete(value); // снимаем 👎, если был
            setLiked(chatId, liked);
            setDisliked(chatId, disliked);
            await sendMessage(chatId, `👍 Отмечено как полезное: «${op.title}»\nБуду показывать похожие чаще.`);
        }
        return;
    }

    if (key === 'dislike') {
        const op = opportunities.find(o => o.id === value);
        if (!op) return;

        const liked = getLiked(chatId);
        const disliked = getDisliked(chatId);

        if (disliked.has(value)) {
            disliked.delete(value);
            setDisliked(chatId, disliked);
            await sendMessage(chatId, `Снял отметку 👎 с «${op.title}»`);
        } else {
            disliked.add(value);
            liked.delete(value);
            setDisliked(chatId, disliked);
            setLiked(chatId, liked);
            await sendMessage(chatId, `👎 Понял, больше не буду показывать «${op.title}».`);
        }
        return;
    }

    if (key === 'action') {
        if (value === 'reset') {
            userStates.set(chatId, { step: 'grade' });
            await sendMessage(chatId, 'Начнём заново. Выбери подходящую тебе категорию)', keyboardGrade());
            return;
        }
        if (value === 'more') {
            userStates.set(chatId, { step: 'grade' });
            await sendMessage(chatId, 'Давай подберём ещё. Уточни еще разок категорию', keyboardGrade());
            return;
        }
    }
}

// =================== Long Polling ===================
// Склонение слова «возможность»
// =================== Long Polling ===================

async function startPolling() {
    console.log('🚀 Бот запущен и слушает сообщения...');

    // Проверка дедлайнов раз в час + сразу при старте
    setInterval(checkDeadlines, 60 * 60 * 1000);
    checkDeadlines();
    // Проверка новых мероприятий по подпискам — раз в 10 минут
    // (для демо на хакатоне: 10 минут = 600 000 мс, в production рекомендуется 1 час)
    setInterval(checkNewOpportunities, 10 * 60 * 1000);

        // Синхронизация с внешними источниками.
    // Для ДЕМО на хакатоне — каждые 15 минут.
    // Для production — раз в сутки ночью: '0 3 * * *'
    cron.schedule('*/15 * * * *', async () => {
        console.log('⏰ Запуск плановой синхронизации...');
        await syncAll();
    });

    // Опционально: запустить один раз при старте (для демо)
    // syncAll().catch(e => console.error('Ошибка старта sync:', e));

    let marker = 0;

    while (true) {
        try {
            const { data } = await api.get('/updates', {
                params: { marker, limit: 100, timeout: 30 }
            });

            const updates = data.updates || [];

            for (const update of updates) {
                if (update.update_id) marker = update.update_id;
                else if (update.timestamp) marker = update.timestamp;

                console.log(`📩 Событие: ${update.update_type}`);

                if (update.update_type === 'bot_started') {
                    await handleBotStarted(update);
                } else if (update.update_type === 'message_created') {
                    await handleMessage(update);
                } else if (update.update_type === 'message_callback') {
                    await handleCallback(update);
                }
            }
        } catch (error) {
            console.error('⚠️ Ошибка polling:', error.response?.data || error.message);
            await new Promise(r => setTimeout(r, 3000));
        }
    }
}

// =================== Точка входа ===================

(async () => {
    try {
        const { data } = await api.get('/me');
        console.log(`✅ Подключение успешно. Бот: ${data.name} (@${data.username})`);
    } catch (error) {
        console.error('❌ Ошибка подключения:', error.response?.data || error.message);
        process.exit(1);
    }
    await startPolling();
})();

// =================== Глобальные обработчики ===================

process.on('unhandledRejection', (reason, promise) => {
    console.error('⚠️ Необработанный Promise rejection:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('⚠️ Необработанное исключение:', error);
    // Не завершаем процесс — продолжаем работу
});