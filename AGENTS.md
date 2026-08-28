# AGENTS.md

## Версионирование проекта

При изменении версии проекта необходимо обновить следующие файлы:

### Список файлов с версией

1. **`src-tauri/Cargo.toml`** — версия в секции `[package]`
   ```toml
   version = "0.1.11"
   ```

2. **`src-tauri/tauri.conf.json`** — поле `version`
   ```json
   "version": "0.1.11"
   ```

3. **`package.json`** — поле `version`
   ```json
   "version": "0.1.11"
   ```

4. **`src/App.tsx`** — отображение версии в модальном окне «О приложении»
   ```tsx
   <p>Версия: 0.1.11</p>
   ```

### Правила версионирования

- Версия во всех файлах должна **совпадать** с тегом релиза (без префикса `v`)
- Формат тега: `v0.1.11` (с префиксом `v`)
- Формат версии в файлах: `0.1.11` (без префикса `v`)
- При создании нового тега через Git, workflow GitHub Actions автоматически соберёт и опубликует релиз

### Пример команды для создания нового релиза

```bash
# 1. Обновить версию во всех файлах
# 2. Закоммитить изменения
git add src-tauri/Cargo.toml src-tauri/tauri.conf.json package.json src/App.tsx
git commit -m "Bump version to 0.1.11"
git push origin main

# 3. Создать тег и запустить автоматическую сборку
git tag v0.1.11
git push origin v0.1.11
```

## Структура проекта

```
market-visualizer/
├── src/                    # Frontend (React + TypeScript)
│   ├── App.tsx             # Главный компонент
│   ├── components/         # Компоненты
│   │   └── TimelineVisualizer.tsx  # D3.js визуализация
│   ├── index.css           # Стили
│   └── types/              # TypeScript типы
├── src-tauri/              # Backend (Rust + Tauri)
│   ├── Cargo.toml          # Rust зависимости
│   ├── tauri.conf.json     # Конфигурация Tauri
│   └── src/                # Rust исходники
├── .github/workflows/      # GitHub Actions
│   └── release.yml         # Workflow для сборки релизов
└── package.json            # Node.js зависимости
```

## Автообновление

Приложение использует `tauri-plugin-updater` для автоматических обновлений.

### Конфигурация updater

Файл: `src-tauri/tauri.conf.json`

```json
{
  "plugins": {
    "updater": {
      "active": true,
      "endpoints": [
        "https://github.com/mystic-solis/market_visualizer/releases/latest/download/update.json"
      ],
      "dialog": false,
      "pubkey": "minisign<->W:QScPnGiraMnCaS3X8o8LwBoZlctDZUDC/XZKmxHUTXo="
    }
  }
}
```

### Как работает обновление

1. При запуске приложение проверяет `update.json` на GitHub
2. Сравнивает версию приложения с версией в манифесте
3. Если новая версия доступна — предлагает пользователю обновление
4. После установки — просит перезапустить приложение

### Публикация релиза для автообновления

1. Создать тег (см. раздел «Версионирование»)
2. GitHub Actions автоматически соберёт проект
3. Релиз публикуется напрямую (не как черновик)
4. Пользователи получают уведомление об обновлении при запуске

## Сборка

### Локальная сборка

```bash
npm run tauri build
```

Результат: `src-tauri/target/release/bundle/nsis/market-visualizer_X.XX.X_x64-setup.exe`

### Автоматическая сборка

При создании тега `v*` автоматически запускается workflow:
- Сборка frontend (`npm run build`)
- Сборка Tauri (`tauri build`)
- Создание NSIS установщика
- Публикация релиза на GitHub

## Источники данных

Приложение поддерживает два источника данных:
- **JSON-файл** — для разработки и тестирования
- **Kafka** — для продакшена

Переключатель источника находится в модальном окне настроек (⚙️ в хедере).

## Экспорт данных

В модальном окне настроек доступен экспорт текущих данных в JSON файл.
Файл сохраняется с именем формата: `market-visualizer-export-YYYY-MM-DDTHH-MM-SS.json`
