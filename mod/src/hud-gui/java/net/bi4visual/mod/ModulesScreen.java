package net.bi4visual.mod;

import java.util.List;
import java.util.function.Consumer;
import java.util.function.Function;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.Font;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;

/**
 * The visuals menu on Right Shift: a dark panel with categories on the left
 * and module cards with switches on the right. Changes are saved at once.
 */
public class ModulesScreen extends Screen {
    private record Module(String name, String hint, Function<Config.Data, String> state, Consumer<Config.Data> toggle) {}

    private record Category(String name, String icon, List<Module> modules) {}

    private static final List<Category> CATEGORIES = List.of(
            new Category("Мир", "◉", List.of(
                    onOff("Текст песен", "Слова играющей песни в мире", d -> d.lyrics, (d, v) -> d.lyrics = v),
                    new Module("Небо", "Галактика и северное сияние ночью (1.21.4–1.21.8)", d -> skyName(d.sky), d -> d.sky = nextSky(d.sky)),
                    onOff("Вечная ночь", "Видишь только ты, сервер не трогаем", d -> d.night, (d, v) -> d.night = v))),
            new Category("Интерфейс", "▣", List.of(
                    onOff("HUD", "Все панели bi4visual", d -> d.hud, (d, v) -> d.hud = v),
                    onOff("Островок", "Ник, время, FPS, пинг и трек сверху", d -> d.island, (d, v) -> d.island = v),
                    onOff("Зелья", "Активные эффекты и сколько осталось", d -> d.potions, (d, v) -> d.potions = v),
                    onOff("Кулдауны", "Перезарядка жемчуга, хоруса и других", d -> d.cooldowns, (d, v) -> d.cooldowns = v),
                    onOff("Броня", "Прочность надетой брони", d -> d.armour, (d, v) -> d.armour = v),
                    onOff("Уведомления", "Сообщения о включении модулей", d -> d.toasts, (d, v) -> d.toasts = v))),
            new Category("Меню", "☰", List.of(
                    onOff("Главное меню", "Своё меню вместо обычного", d -> d.menu, (d, v) -> d.menu = v))));

    private static int selected;

    public ModulesScreen() {
        super(Component.literal("bi4visual"));
    }

    private int px, py, pw = 380, ph = 230;

    @Override
    protected void init() {
        px = (width - pw) / 2;
        py = (height - ph) / 2;
        for (int i = 0; i < CATEGORIES.size(); i++) {
            int index = i;
            Category c = CATEGORIES.get(i);
            addRenderableWidget(new MenuButton(px + 8, py + 34 + i * 20, 92, 17, c.icon + "  " + c.name,
                    (g, b, hover) -> drawCategory(g, b, index == selected, hover), b -> {
                        selected = index;
                        rebuildWidgets();
                    }));
        }
        List<Module> modules = CATEGORIES.get(selected).modules;
        int cx = px + 112;
        int cw = (pw - 112 - 8 - 6) / 2;
        for (int i = 0; i < modules.size(); i++) {
            Module m = modules.get(i);
            int x = cx + (i % 2) * (cw + 6);
            int y = py + 30 + (i / 2) * 46;
            addRenderableWidget(new MenuButton(x, y, cw, 40, m.name, (g, b, hover) -> drawCard(g, b, m, hover), b -> {
                Config.Data d = Config.get();
                m.toggle.accept(d);
                Config.save(d);
                String state = m.state.apply(d);
                Hud.notify(m.name, state.equals("вкл") ? "включён" : state.equals("выкл") ? "выключен" : "— " + state);
            }));
        }
    }

    @Override
    public void render(GuiGraphics g, int mouseX, int mouseY, float partial) {
        g.fill(0, 0, width, height, 0x66000000);
        int accent = Config.accent();
        Font font = minecraft.font;
        rounded(g, px, py, pw, ph, 0xEE0F1217);
        g.fill(px + 104, py + 8, px + 105, py + ph - 8, 0x14FFFFFF);
        g.drawString(font, Fonts.hud("bi4visual"), px + 12, py + 12, 0xFFF1F3F8, false);
        g.drawString(font, Fonts.hud("1.0"), px + 12 + font.width(Fonts.hud("bi4visual ")), py + 12, accent, false);
        g.drawString(font, Fonts.hud(CATEGORIES.get(selected).name), px + 114, py + 12, 0xFFF1F3F8, false);
        String hint = "Правый Shift или Esc — закрыть";
        g.drawString(font, Fonts.hud(hint), px + pw - 10 - font.width(Fonts.hud(hint)), py + 12, 0xFF6B7280, false);
        String nick = minecraft.player != null ? minecraft.player.getName().getString() : minecraft.getUser().getName();
        rounded(g, px + 8, py + ph - 30, 92, 22, 0xFF161A21);
        g.drawString(font, Fonts.hud(nick), px + 14, py + ph - 26, 0xFFF1F3F8, false);
        g.drawString(font, Fonts.hud("Free · 1.0"), px + 14, py + ph - 16, 0xFF6B7280, false);
        super.render(g, mouseX, mouseY, partial);
    }

    @Override
    public void renderBackground(GuiGraphics g, int mouseX, int mouseY, float partial) {
        // In game the world stays visible behind the menu, only dimmed in render().
        if (minecraft.level == null) super.renderBackground(g, mouseX, mouseY, partial);
    }

    @Override
    public boolean isPauseScreen() {
        return false;
    }

    // ---------- drawing ----------

    private static void drawCategory(GuiGraphics g, Button b, boolean active, boolean hover) {
        if (active || hover) rounded(g, b.getX(), b.getY(), b.getWidth(), b.getHeight(), active ? 0xFF1C212B : 0xFF161A21);
        if (active) g.fill(b.getX(), b.getY() + 4, b.getX() + 2, b.getY() + b.getHeight() - 4, Config.accent());
        Font font = Minecraft.getInstance().font;
        g.drawString(font, Fonts.hud(b.getMessage().getString()), b.getX() + 8, b.getY() + 5, active ? 0xFFF1F3F8 : 0xFF8E95A6, false);
    }

    private static void drawCard(GuiGraphics g, Button b, Module m, boolean hover) {
        int x = b.getX(), y = b.getY(), w = b.getWidth(), h = b.getHeight();
        int accent = Config.accent();
        rounded(g, x, y, w, h, hover ? 0xFF1C212B : 0xFF161A21);
        Font font = Minecraft.getInstance().font;
        g.drawString(font, Fonts.hud(m.name), x + 8, y + 7, 0xFFF1F3F8, false);
        String hint = m.hint;
        while (hint.length() > 3 && font.width(Fonts.hud(hint)) > w - 16) hint = hint.substring(0, hint.length() - 2);
        if (!hint.equals(m.hint)) hint = hint.trim() + "…";
        g.drawString(font, Fonts.hud(hint), x + 8, y + 24, 0xFF6B7280, false);
        String state = m.state.apply(Config.get());
        boolean on = !state.equals("выкл");
        if (state.equals("вкл") || state.equals("выкл")) {
            int sx = x + w - 26, sy = y + 7;
            rounded(g, sx, sy, 18, 10, on ? accent : 0xFF2A303B);
            int kx = on ? sx + 10 : sx + 2;
            g.fill(kx, sy + 2, kx + 6, sy + 8, 0xFFFFFFFF);
        } else {
            int tw = font.width(Fonts.hud(state));
            g.drawString(font, Fonts.hud(state), x + w - 8 - tw, y + 7, accent, false);
        }
    }

    static void rounded(GuiGraphics g, int x, int y, int w, int h, int c) {
        g.fill(x + 2, y, x + w - 2, y + 1, c);
        g.fill(x + 1, y + 1, x + w - 1, y + 2, c);
        g.fill(x, y + 2, x + w, y + h - 2, c);
        g.fill(x + 1, y + h - 2, x + w - 1, y + h - 1, c);
        g.fill(x + 2, y + h - 1, x + w - 2, y + h, c);
    }

    // ---------- modules ----------

    private interface Setter {
        void set(Config.Data d, boolean v);
    }

    private static Module onOff(String name, String hint, Function<Config.Data, Boolean> get, Setter set) {
        return new Module(name, hint, d -> get.apply(d) ? "вкл" : "выкл", d -> set.set(d, !get.apply(d)));
    }

    private static String skyName(String sky) {
        return switch (sky) {
            case "aurora" -> "Сияние";
            case "both" -> "Оба";
            case "off" -> "выкл";
            default -> "Галактика";
        };
    }

    private static String nextSky(String sky) {
        return switch (sky) {
            case "galaxy" -> "aurora";
            case "aurora" -> "both";
            case "both" -> "off";
            default -> "galaxy";
        };
    }
}
