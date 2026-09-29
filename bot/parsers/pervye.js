import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * Парсит проекты и конкурсы с сайта «Движения Первых».
 */
export async function parsePervye() {
    try {
        const { data } = await axios.get('https://будьвдвижении.рф/projects', {
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; TraektoriaBot/1.0; educational)'
            }
        });

        const $ = cheerio.load(data);
        const events = [];

        $('a[href*="/project"], a[href*="/projects/"]').each((i, el) => {
            const title = $(el).text().trim();
            const link = $(el).attr('href');

            if (title && link && title.length > 5 && title.length < 200) {
                events.push({
                    id: `pervye-${Date.now()}-${i}`,
                    title,
                    type: 'проект',
                    grade: ['5-7', '8-9', '10-11', 'студент-спо'],
                    federal_district: 'Россия',
                    city: 'Разные города',
                    format: 'гибрид',
                    interests: ['наука', 'искусство', 'бизнес'],
                    deadline: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000)
                        .toISOString().slice(0, 10),
                    link: link.startsWith('http')
                        ? link
                        : `https://будьвдвижении.рф${link}`,
                    source: 'Движение Первых (парсинг)',
                    is_all_russian: true,
                });
            }
        });

        const unique = Array.from(
            new Map(events.map(e => [e.title, e])).values()
        ).slice(0, 20);

        console.log(`✅ Движение Первых: найдено ${unique.length} мероприятий`);
        return unique;
    } catch (error) {
        console.error('❌ Ошибка парсинга «Движения Первых»:', error.message);
        return [];
    }
}