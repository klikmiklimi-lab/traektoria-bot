import GigaChat from 'gigachat';
import { Agent } from 'node:https';

const httpsAgent = new Agent({
    // В production — используем сертификаты Минцифры через NODE_EXTRA_CA_CERTS
    // Для локальной разработки оставляем false
    rejectUnauthorized: process.env.NODE_ENV === 'production',
});

const client = new GigaChat({
    timeout: 600,
    model: 'GigaChat-2-Pro',
    credentials: process.env.GIGACHAT_CREDENTIALS,
    scope: 'GIGACHAT_API_PERS',
    httpsAgent,
});

/**
 * Задаёт вопрос GigaChat и возвращает ответ.
 * @param {string} prompt — текст запроса
 * @returns {Promise<string>} — ответ модели
 */
export async function askGigaChat(prompt) {
    try {
        const resp = await client.chat({
            messages: [{ role: 'user', content: prompt }],
        });
        return resp.choices[0]?.message?.content || 'Не удалось получить ответ.';
    } catch (error) {
        console.error('❌ GigaChat ошибка:', error.message);
        return '⚠️ Сервис временно недоступен. Попробуй позже.';
    }
}

/**
 * Подбирает мероприятия из базы через GigaChat (RAG-подход).
 * @param {string} userQuery — свободный запрос пользователя
 * @param {Array} opportunities — массив мероприятий
 * @returns {Promise<string>} — рекомендация
 */
export async function recommendWithGigaChat(userQuery, opportunities) {
    const catalog = opportunities
        .slice(0, 30)
        .map(o => `- ${o.title} | ${o.type} | ${o.federal_district} | ${o.interests.join(', ')} | дедлайн ${o.deadline}`)
        .join('\n');

    const prompt =
        `Ты — помощник по образовательным возможностям. Пользователь спрашивает: "${userQuery}".\n\n` +
        `Вот каталог доступных мероприятий:\n${catalog}\n\n` +
        `Выбери 2-3 наиболее подходящих и кратко объясни, почему они подходят пользователю. ` +
        `Отвечай дружелюбно, на русском, с эмодзи.`;

    return await askGigaChat(prompt);
}