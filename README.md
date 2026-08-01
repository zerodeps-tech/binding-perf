[![Node.js 24](https://img.shields.io/badge/Node.js-24-brightgreen)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

# binding-perf

Воспроизводимый стенд к статье «Дело о пропавшем RPS».

Он проверяет простой тезис: один широкий вызов JavaScript → C++ не обязан быть
быстрее нескольких узких. Цена зависит от работы и данных за границей, а не от
самого количества вызовов.

## Результат

Основной прогон:

- Linux x86_64, Intel Xeon E5-2680 v4;
- Node.js 24.17.0;
- `@swarmmachina/swm-core` 4.1.1;
- `@swarmmachina/swm-uws` 0.5.7;
- `@swarmmachina/benchkit` 0.2.0.

| Fast path | Сценарий | Δ RPS | Δ CPU/запрос | Δ p99 |
| --- | --- | ---: | ---: | ---: |
| `requestSnapshot` | async GET | **−25,55%** | **+34,30%** | **+29,99%** |
| `responseBatch` | подготовленные заголовки | −0,62% | +0,62% | +1,47% |
| `collectBody` | POST, JSON 45 байт | +0,78% | −0,85% | −3,88% |

У `requestSnapshot` все центральные 50% парных наблюдений остались ниже нуля:
RPS от −31,06% до −24,92%. Это устойчивая регрессия данного контракта.

У `responseBatch` и `collectBody` диапазоны захватили оба знака. Отдельные
all-control серии, где все три процесса были одинаковыми, сами нарисовали от
−4,89% до +5,07% RPS. Поэтому эффекты этих двух кандидатов не удалось отделить
от шума.

Полная таблица и абсолютные значения лежат в
[`results/benchkit-report.md`](results/benchkit-report.md). Сырые пары лежат в
[`results/benchkit/`](results/benchkit/).

## Повторить основной замер

Нужен Linux с `taskset` и Node.js 24.

```bash
npm ci
npm run benchmark:all
npm run report:benchkit
```

`swm-core` устанавливается из npm как обычная зависимость. Клон исходников,
`SWM_CORE_DIR` и импорты из чужого `benchmark/` не нужны.

Полный запуск использует:

- 100 соединений и четыре рабочих потока;
- 30 секунд прогрева каждого процесса;
- 12 раундов по 15 секунд для каждого fast path;
- два control-процесса рядом с кандидатом;
- смену всех трёх процессных слотов;
- отдельный all-control для каждого сценария.

По умолчанию сервер закреплён за CPU 2, генератор нагрузки за CPU 3–6.
Переопределить их можно через `SWM_SERVER_CPU`, `SWM_LOAD_CPUS` и `NODE_BIN`.

## Что запускается

| Файл | Роль |
| --- | --- |
| [`harness/scenarios.js`](harness/scenarios.js) | три сценария и их параметры |
| [`harness/swm-core-target.js`](harness/swm-core-target.js) | минимальный сервер на опубликованном `swm-core` |
| [`harness/native-fast-path-triad.js`](harness/native-fast-path-triad.js) | два контроля, кандидат и парный расчёт |
| [`scripts/run-all-benchmarks.sh`](scripts/run-all-benchmarks.sh) | полный прогон и замена результатов после успеха |
| [`scripts/summarize-benchkit.js`](scripts/summarize-benchkit.js) | отчёт из сырых JSON |

Benchkit создаёт нагрузку, считает p95/p99 и собирает CPU, ELU и память
целевого процесса. `autocannon` здесь не используется.

## Что съедает RPS

Первый смешанный профиль показал масштаб регрессии: у `requestSnapshot` на
47,5% больше инструкций и на 52,4% больше циклов на запрос. Но опубликованный
бинарник не позволял разделить цену отдельных частей снимка.

Поэтому `swm-uws` 0.5.7 был собран с символами и диагностическим переключателем.
Каждый следующий режим добавлял одну часть `snapshot()`: контейнеры, имена
свойств, method, URL, query, заголовки и параметры.

Повторный прогон на том же Xeon дал такой итог:

- один переход с готовым снимком сэкономил 4 027 инструкций на запрос;
- полная материализация снимка добавила 15 055 инструкций;
- относительно старого пути осталось 11 028 лишних инструкций на запрос;
- собственный кадр `RequestSnapshot` занял 1,21% семплов. Основная работа
  оказалась внутри V8.

Полная таблица лежит в
[`results/request-snapshot-ablation.md`](results/request-snapshot-ablation.md),
сырые результаты каждого режима в [`results/ablation/`](results/ablation/).
Первый профиль сохранён отдельно в
[`results/request-snapshot-cpu-profile.md`](results/request-snapshot-cpu-profile.md).

## Повторить профиль

Нужен Linux с `perf`, `taskset`, доступом к CPU governor и клоном
`swm-uws`, в котором есть тег `v0.5.7`:

```bash
git clone https://github.com/SwarmMachina/swm-uws.git
SWM_UWS_SOURCE_DIR="$PWD/swm-uws" npm run profile:ablation
```

Скрипт берёт точный тег через `git archive`, применяет оба патча из
[`patches/`](patches/), собирает биндинг, запускает его тесты и только потом
снимает десять профилей. Исходный клон и установленный npm-пакет он не меняет.
Результаты заменяются лишь после успешного полного прогона.

Каждый режим прогревается 30 секунд. Затем идут 30 секунд `perf stat` и
30 секунд `perf record`. Сервер закреплён за CPU 2, нагрузка за CPU 3–6.
Настройки можно изменить через `SWM_SERVER_CPU`, `SWM_LOAD_CPUS`,
`SWM_GOVERNOR_CPUS` и `NODE_BIN`.

Одиночные профили опубликованного бинарника по-прежнему доступны:

```bash
npm run profile:control
npm run profile:snapshot
```

## Граница вывода

Это измерение конкретных версий, железа и трёх сценариев. Оно не доказывает,
что C++, Node-API или нативные модули медленные сами по себе. Оно показывает
более узкую вещь: меньше переходов через биндинг ещё не означает меньше работы.

---

MIT © [VaskoDeGama](https://github.com/VaskoDeGama) / zero_deps
