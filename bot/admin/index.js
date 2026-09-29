import 'dotenv/config';
import { PARTNERS } from '../config/partners.js';
import { REGIONS, getPilotRegions, getAllRegionsByDistrict } from '../config/regions.js';

/**
 * Список ID координаторов. В production — с авторизацией.
 * Для MVP — читаем из .env (ADMIN_CHAT_IDS через запятую).
 **/
const ADMINS = new Set(
    (process.env.ADMIN_CHAT_IDS || '').split(',').map(s => s.trim()).filter(Boolean)
);

/**
 * Проверяет, является ли пользователь админом.
 */
export function isAdmin(chatId) {
    return ADMINS.has(String(chatId));
}

/**
 * Статистика по регионам.
 */
export function getScalingReport() {
    const federalDistricts = Object.values(REGIONS)
        .filter(r => !r.is_pilot)
        .map(r => r.federal_district);

    const pilots = getPilotRegions();

    return {
        totalFederalDistricts: new Set(federalDistricts).size,
        totalRegionsConfigured: Object.keys(REGIONS).length,
        pilots: pilots.map(p => ({
            name: p.name,
            district: p.federal_district,
            partners: p.partners.length,
            sources: p.sources.length
        })),
        partners: {
            federal: PARTNERS.federal.length,
            regional: Object.keys(PARTNERS.regional).length,
            local: PARTNERS.local.length
        }
    };
}

/**
 * Форматирует отчёт для отправки в MAX.
 */
export function formatScalingReport() {
    const r = getScalingReport();

    const pilotLines = r.pilots.map(p =>
        `• ${p.name} (${p.district}) — ${p.partners} партнёров, ${p.sources} источников`
    ).join('\n');

    return `📈 *Отчёт по масштабированию*\n\n` +
           `🌍 Настроено регионов: *${r.totalRegionsConfigured}*\n` +
           `🏛️ Округов: *${r.totalFederalDistricts}*\n` +
           `🚀 Пилотных регионов: *${r.pilots.length}*\n\n` +
           `*Пилоты:*\n${pilotLines}\n\n` +
           `*Партнёры:*\n` +
           `• Федеральные: ${r.partners.federal}\n` +
           `• Региональные: ${r.partners.regional}\n` +
           `• Локальные: ${r.partners.local}`;
}

/**
 * План масштабирования на 4 этапа.
 */
export function getScalingRoadmap() {
    return [
        {
            stage: '1. Пилот',
            period: '1–2 месяца',
            region: 'Казань, Республика Татарстан',
            targets: '3 школы, 500+ пользователей',
            metrics: 'NPS > 40, завершение сценария > 60%'
        },
        {
            stage: '2. Регион',
            period: '3–6 месяцев',
            region: 'Республика Татарстан',
            targets: '50+ школ, 10 000 пользователей',
            metrics: 'Соглашение с Минобрнауки РТ, интеграция с ЭЖД'
        },
        {
            stage: '3. Федеральный округ',
            period: '6–12 месяцев',
            region: 'Приволжский ФО (14 регионов)',
            targets: '200+ школ, 100 000 пользователей',
            metrics: 'Подключение ФГИС «Моя школа», партнёрство с вузами'
        },
        {
            stage: '4. Всероссийский',
            period: '1–2 года',
            region: 'Все 8 федеральных округов',
            targets: '1 млн+ пользователей',
            metrics: 'Интеграция со Сферум, Движение Первых, «Работа России»'
        }
    ];
}

/**
 * Форматирует roadmap для чата.
 */
export function formatRoadmap() {
    const stages = getScalingRoadmap();
    return stages.map(s =>
        `*${s.stage}* — ${s.period}\n` +
        `📍 ${s.region}\n` +
        `🎯 ${s.targets}\n` +
        `📊 ${s.metrics}`
    ).join('\n\n');
}