# bi4visual launcher

Лаунчер Minecraft: Java Edition. Одна большая кнопка «Играть», остальное — в настройках.

![Главный экран](docs/main.png)

## Что умеет

- Главный экран: 3D-модель вашего скина и большая кнопка «Играть».
- Сборки: у каждой своя версия игры, загрузчик и папка с модами, сохранениями и настройками.
- Любая версия Minecraft, загрузчики Fabric, Forge, NeoForge и Quilt.
- Каталог модов Modrinth с установкой зависимостей, включение и выключение модов.
- Модпаки Modrinth в один клик: ставятся как новая сборка.
- Аккаунты: без пароля по нику или вход через Microsoft (лицензия), смена скина для лицензии.
- Сам скачивает нужную Java (Eclipse Temurin 8, 17 или 21).
- Свою картинку можно поставить на фон, с затемнением и размытием.
- Время игры в каждой сборке.
- Настройки памяти, размера окна и аргументов JVM, журнал игры при ошибке.

## Сборка

Нужны [Rust](https://rustup.rs), [Bun](https://bun.sh) и [зависимости Tauri](https://tauri.app/start/prerequisites/).

```sh
bun install
bun run tauri dev      # запуск для разработки
bun run tauri build    # установщик в target/release/bundle
cargo test -p bi4visual-core
```

Готовые сборки для Windows, macOS и Linux собирает GitHub Actions при каждом пуше
(вкладка Actions → Artifacts). Для тега `v*` создаётся черновик релиза.

### Вход через Microsoft

Чтобы работал вход с лицензией, нужен свой Client ID:

1. Зарегистрируйте приложение в [Azure Portal](https://portal.azure.com) → App registrations,
   тип аккаунтов «Personal Microsoft accounts only», включите «Allow public client flows».
2. Подайте заявку Mojang на доступ к Minecraft API:
   <https://aka.ms/mce-reviewappid>. Без одобрения вход вернёт ошибку.
3. Задайте ID при сборке: переменная окружения `BI4VISUAL_MS_CLIENT_ID`
   (в GitHub — секрет репозитория с тем же именем).

Без ID лаунчер работает только с аккаунтами по нику.

## Устройство

- `core/` — вся логика без интерфейса: список версий, загрузка файлов с проверкой SHA-1,
  библиотеки и natives, ресурсы, загрузчики модов, сборки, Modrinth, Java, аккаунты, скины,
  сборка командной строки.
- `src-tauri/` — оболочка Tauri: команды и события для интерфейса, запуск процесса игры.
- `src/` — интерфейс на React.

Данные хранятся в `%APPDATA%\bi4visual-launcher` (Windows),
`~/Library/Application Support/bi4visual-launcher` (macOS) или `~/.local/share/bi4visual-launcher` (Linux).

Minecraft — товарный знак Mojang Synergies AB / Microsoft. Проект с ними не связан.
