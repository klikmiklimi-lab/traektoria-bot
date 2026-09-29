/**
 * Конфигурация регионов для масштабирования.
 *
 * Принцип: чтобы добавить новый регион, достаточно добавить запись в REGIONS.
 * Код бота, парсеры и UX-сценарий НЕ меняются.
 *
 * Для каждого региона указываем:
 *  - code: короткий код (используется в диплинках)
 *  - federal_district: код округа из справочника
 *  - sources: список сайтов-источников для парсера
 *  - partners: организации-партнёры
 *  - contacts: контакты регионального координатора
 */

export const REGIONS = {
    // ============== ЦЕНТРАЛЬНЫЙ ФО ==============
    'cfo_default': {
        name: 'Центральный ФО',
        federal_district: 'ЦФО',
        code: 'cfo',
        sources: [
            'https://olimpiada.ru',
            'https://mos.ru/olympiads'
        ],
        partners: [
            'Департамент образования г. Москвы',
            'НИУ ВШЭ', 'МГУ', 'МФТИ', 'МГИМО'
        ],
        coordinator_email: 'cfo@traektoria.ru'
    },
    'cfo_tatarstan_reference': {
        // пример регионального конфига для будущего расширения
        name: 'Республика Татарстан',
        federal_district: 'ПФО',
        code: 'tatarstan',
        sources: [
            'https://olimpiada.ru',
            'https://minobrnauki.tatarstan.ru',
            'https://kpfu.ru/olymp'
        ],
        partners: [
            'Минобрнауки Республики Татарстан',
            'КФУ', 'КНИТУ-КАИ', 'Университет Иннополис',
            'IT-лицей КФУ', 'Лицей №131'
        ],
        coordinator_email: 'tatarstan@traektoria.ru',
        is_pilot: true   // ← флаг пилотного региона
    },

    // ============== СЕВЕРО-ЗАПАДНЫЙ ФО ==============
    'szfo_default': {
        name: 'Северо-Западный ФО',
        federal_district: 'СЗФО',
        code: 'szfo',
        sources: [
            'https://olimpiada.ru',
            'https://olympiada.spbu.ru'
        ],
        partners: [
            'Комитет по образованию СПб',
            'СПбГУ', 'ИТМО', 'СПбПУ'
        ],
        coordinator_email: 'szfo@traektoria.ru'
    },

    // ============== ЮЖНЫЙ ФО ==============
    'ufo_default': {
        name: 'Южный ФО',
        federal_district: 'ЮФО',
        code: 'ufo',
        sources: [
            'https://olimpiada.ru',
            'https://sfedu.ru'
        ],
        partners: [
            'ЮФУ', 'КубГУ', 'ДГТУ',
            'Образовательный центр «Сириус»'
        ],
        coordinator_email: 'ufo@traektoria.ru'
    },

    // ============== СЕВЕРО-КАВКАЗСКИЙ ФО ==============
    'skfo_default': {
        name: 'Северо-Кавказский ФО',
        federal_district: 'СКФО',
        code: 'skfo',
        sources: [
            'https://olimpiada.ru',
            'https://ncfu.ru'
        ],
        partners: ['СКФУ', 'ДГУ'],
        coordinator_email: 'skfo@traektoria.ru'
    },

    // ============== ПРИВОЛЖСКИЙ ФО ==============
    'pfo_default': {
        name: 'Приволжский ФО',
        federal_district: 'ПФО',
        code: 'pfo',
        sources: [
            'https://olimpiada.ru',
            'https://kpfu.ru',
            'https://ntcontest.ru'
        ],
        partners: [
            'КФУ', 'Университет Иннополис', 'ННГУ', 'СамГУ',
            'Кружковое движение НТИ'
        ],
        coordinator_email: 'pfo@traektoria.ru'
    },

    // ============== УРАЛЬСКИЙ ФО ==============
    'urfo_default': {
        name: 'Уральский ФО',
        federal_district: 'УФО',
        code: 'urfo',
        sources: [
            'https://olimpiada.ru',
            'https://urfu.ru'
        ],
        partners: ['УрФУ', 'ЮУрГУ'],
        coordinator_email: 'urfo@traektoria.ru'
    },

    // ============== СИБИРСКИЙ ФО ==============
    'sfo_default': {
        name: 'Сибирский ФО',
        federal_district: 'СФО',
        code: 'sfo',
        sources: [
            'https://olimpiada.ru',
            'https://nsu.ru',
            'https://tsu.ru'
        ],
        partners: ['НГУ', 'ТГУ', 'СФУ', 'НГТУ'],
        coordinator_email: 'sfo@traektoria.ru'
    },

    // ============== ДАЛЬНЕВОСТОЧНЫЙ ФО ==============
    'dfo_default': {
        name: 'Дальневосточный ФО',
        federal_district: 'ДФО',
        code: 'dfo',
        sources: [
            'https://olimpiada.ru',
            'https://dvfu.ru'
        ],
        partners: ['ДВФУ', 'ТОГУ'],
        coordinator_email: 'dfo@traektoria.ru'
    }
};

/**
 * Возвращает конфиг для конкретного федерального округа.
 */
export function getRegionByDistrict(district) {
    for (const [key, region] of Object.entries(REGIONS)) {
        if (region.federal_district === district && !region.is_pilot) {
            return region;
        }
    }
    return null;
}

/**
 * Возвращает все регионы по округу (для масштабирования).
 */
export function getAllRegionsByDistrict(district) {
    return Object.values(REGIONS).filter(r => r.federal_district === district);
}

/**
 * Список пилотных регионов.
 */
export function getPilotRegions() {
    return Object.values(REGIONS).filter(r => r.is_pilot);
}