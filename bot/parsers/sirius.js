import axios from 'axios';
import * as cheerio from 'cheerio';

export async function parsePervye() {
    try {
        // Используем сайт с открытой структурой (не требует JS)
        const { data } = await axios.get('https://sochisirius.ru/news', {
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; TraektoriaBot/1.0; educational)'
            }
        });

        const $ = cheerio.load(data);
        const events = [];

        // Извлекаем новости/анонсы
        $('a').each((i, el) => {
            const title = $(el).text().trim();
            const link = $(el).attr('href');

            // Фильтруем только осмысленные ссылки
            if (title && link && title.length > 15 && title.length < 200 &&
                (title.toLowerCase().includes('школ') ||
                 title.toLowerCase().includes('курс') ||
                 title.toLowerCase().includes('программ') ||
                 title.toLowerCase().includes('смен'))) {
                events.push({
                    id: `sirius-${Date.now()}-${i}`,
                    title,
                    type: 'курс',
                    grade: ['8-9', '10-11'],
                    federal_district: 'ЮФО',
                    city: 'Сочи',
                    format: 'оффлайн',
                    interests: ['наука'],
                    deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                        .toISOString().slice(0, 10),
                    link: link.startsWith('http') ? link : `https://sochisirius.ru${link}`,
                    source: 'Сириус (парсинг)',
                    is_all_russian: true,
                });
            }
        });

        const unique = Array.from(
            new Map(events.map(e => [e.title, e])).values()
        ).slice(0, 25);

        console.log(`✅ Сириус: найдено ${unique.length}`);
        return unique;
    } catch (error) {
        console.error('❌ Ошибка парсинга Сириуса:', error.message);
        return [];
    }
}