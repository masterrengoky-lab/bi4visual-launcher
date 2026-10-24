package net.bi4visual.mod;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.stream.Stream;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.Font;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.AbstractWidget;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.components.EditBox;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;
import net.minecraft.world.entity.player.Player;

/**
 * The visuals menu on Right Shift: a glassy panel with sections on the left
 * (Render, Interface, Utility, Themes, Waypoints, Configs), a search box on
 * top and module cards in two columns, each with a bind and a switch.
 */
public class ModulesScreen extends Screen {
    private static final int TEXT = 0xFFF1F3F8;
    private static final int MUTED = 0xFF7B8190;
    private static final int CARD = 0xC0181B22;
    private static final int CARD_HOVER = 0xD0202430;

    private enum Page {
        RENDER("Render", "◈", Modules.Category.RENDER),
        INTERFACE("Interface", "▣", Modules.Category.INTERFACE),
        UTILITY("Utility", "✱", Modules.Category.UTILITY),
        COSMETICS("Cosmetics", "⚔", null),
        THEMES("Themes", "✎", null),
        WAYPOINTS("Waypoints", "◎", null),
        CONFIGS("Configs", "⟳", null);

        final String title;
        final String icon;
        final Modules.Category category;

        Page(String title, String icon, Modules.Category category) {
            this.title = title;
            this.icon = icon;
            this.category = category;
        }
    }

    private static Page page = Page.RENDER;
    private static String query = "";
    private static int scroll;
    private static String capturing;
    /** Which part of the Cosmetics section is open: model, swords or world. */
    private static String cosTab = "swords";

    private final List<AbstractWidget> content = new ArrayList<>();
    private EditBox search;
    private EditBox nameBox;
    private EditBox xBox, yBox, zBox;
    private int px, py, pw, ph, cx, cy, cw, ch;

    public ModulesScreen() {
        super(Component.literal("bi4visual"));
    }

    /** True while the menu waits for a key to bind; the game must not act on that key. */
    public static boolean capturing() {
        return capturing != null;
    }

    @Override
    protected void init() {
        pw = Math.min(430, width - 16);
        ph = Math.min(250, height - 16);
        px = (width - pw) / 2;
        py = (height - ph) / 2;
        cx = px + 100;
        cy = py + 28;
        cw = pw - 100 - 8;
        ch = ph - 28 - 8;

        int y = py + 30;
        String[] groups = {"Visual", null, "Other", "Client", null, null, null};
        Page[] pages = Page.values();
        for (int i = 0; i < pages.length; i++) {
            if (groups[i] != null) y += 10;
            Page p = pages[i];
            addRenderableWidget(new MenuButton(px + 6, y, 86, 15, p.icon + "  " + p.title,
                    (g, b, hover) -> drawSection(g, b, p == page && query.isEmpty(), hover), b -> {
                        page = p;
                        scroll = 0;
                        query = "";
                        if (search != null) search.setValue("");
                        rebuildContent();
                    }));
            y += 16;
        }

        search = new EditBox(font, px + pw - 108, py + 8, 100, 13, Component.literal("Search"));
        search.setHint(Component.literal("Search"));
        search.setValue(query);
        search.setResponder(text -> {
            if (!text.equals(query)) {
                query = text;
                scroll = 0;
                rebuildContent();
            }
        });
        addRenderableWidget(search);
        rebuildContent();
    }

    private void rebuildContent() {
        for (AbstractWidget w : content) removeWidget(w);
        content.clear();
        nameBox = xBox = yBox = zBox = null;
        if (!query.isBlank() || page.category != null) {
            modules();
        } else if (page == Page.COSMETICS) {
            cosmetics();
        } else if (page == Page.THEMES) {
            themes();
        } else if (page == Page.WAYPOINTS) {
            waypoints();
        } else {
            configs();
        }
    }

    private <T extends AbstractWidget> T add(T w) {
        content.add(w);
        return addRenderableWidget(w);
    }

    // ---------- pages ----------

    private List<Modules.Module> shownModules() {
        if (query.isBlank()) return Modules.in(page.category);
        String q = query.toLowerCase(Locale.ROOT);
        List<Modules.Module> out = new ArrayList<>();
        for (Modules.Module m : Modules.ALL) {
            if (m.name().toLowerCase(Locale.ROOT).contains(q) || m.hint().toLowerCase(Locale.ROOT).contains(q)) out.add(m);
        }
        return out;
    }

    private void modules() {
        modules(shownModules(), cy, ch);
    }

    private void modules(List<Modules.Module> list, int cy, int ch) {
        int colW = (cw - 6) / 2;
        int rowH = 32;
        int rows = (list.size() + 1) / 2;
        int visible = Math.max(1, ch / rowH);
        scroll = Math.max(0, Math.min(scroll, rows - visible));
        for (int i = 0; i < list.size(); i++) {
            int row = i / 2 - scroll;
            if (row < 0 || row >= visible) continue;
            Modules.Module m = list.get(i);
            int x = cx + (i % 2) * (colW + 6);
            int y = cy + row * rowH;
            // The bind chip goes first, so it gets the click before the card under it.
            int chipW = 30;
            int chipX = x + colW - 26 - chipW - 4;
            add(new MenuButton(chipX, y + 6, chipW, 11, "bind", (g, b, hover) -> drawChip(g, b, m, hover), b -> {
                capturing = m.id();
            }));
            add(new MenuButton(x, y, colW, rowH - 4, m.name(), (g, b, hover) -> drawCard(g, b, m, hover), b -> Modules.click(m)));
        }
    }

    private void themes() {
        int cols = 3;
        int w = (cw - (cols - 1) * 6) / cols;
        int h = 30;
        for (int i = 0; i < Config.THEMES.size(); i++) {
            Config.Theme t = Config.THEMES.get(i);
            int row = i / cols - scroll;
            if (row < 0 || (row + 1) * (h + 6) > ch) continue;
            int x = cx + (i % cols) * (w + 6);
            int y = cy + row * (h + 6);
            add(new MenuButton(x, y, w, h, t.name(), (g, b, hover) -> drawTheme(g, b, t, hover), b -> {
                Config.Data d = Config.get();
                d.theme = t.id();
                Config.save(d);
                Hud.notify("Тема", t.name());
            }));
        }
    }

    private void cosmetics() {
        String[][] tabs = {{"model", "Кастом модель"}, {"swords", "Кастом мечи"}, {"world", "Косметика"}};
        int x = cx;
        for (String[] tab : tabs) {
            int w = font.width(Fonts.small(tab[1])) + 14;
            add(new MenuButton(x, cy, w, 13, tab[1], (g, b, hover) -> drawTab(g, b, tab[1], tab[0].equals(cosTab), hover), b -> {
                cosTab = tab[0];
                scroll = 0;
                rebuildContent();
            }));
            x += w + 4;
        }
        if (cosTab.equals("model")) modules(Modules.in(Modules.Category.MODEL), cy + 19, ch - 19);
        else if (cosTab.equals("world")) world(cy + 19, ch - 19);
        else swords(cy + 19, ch - 19);
    }

    /** Cosmetics tab: halo, aura and orbit cards on top, capes from the pack below. */
    private void world(int cy, int ch) {
        List<Modules.Module> list = Modules.in(Modules.Category.WORLD);
        int rowH = 32;
        int top = ((list.size() + 1) / 2) * rowH;
        modules(list, cy, top);
        List<String> capes = new ArrayList<>();
        capes.add("");
        capes.addAll(Cosmetics.capes());
        if (capes.size() == 1) return;
        int cols = 4;
        int w = (cw - (cols - 1) * 5) / cols;
        int y0 = cy + top + 2;
        for (int i = 0; i < capes.size(); i++) {
            int y = y0 + (i / cols) * 20;
            if (y + 16 > cy + ch) break;
            String name = capes.get(i);
            add(new MenuButton(cx + (i % cols) * (w + 5), y, w, 16, name, (g, b, hover) -> drawTab(g, b,
                    name.isEmpty() ? "Без плаща" : "Плащ " + name, name.equals(Config.get().cape), hover), b -> {
                Config.Data d = Config.get();
                d.cape = name;
                Config.save(d);
                Hud.notify("Плащ", name.isEmpty() ? "снят" : name);
            }));
        }
    }

    private void swords(int cy, int ch) {
        List<String> names = new ArrayList<>();
        names.add("");
        names.addAll(Cosmetics.names());
        if (names.size() == 1) return;
        int cols = 5;
        int w = (cw - (cols - 1) * 5) / cols;
        int h = 40;
        int visible = Math.max(1, ch / (h + 5));
        int rows = (names.size() + cols - 1) / cols;
        scroll = Math.max(0, Math.min(scroll, rows - visible));
        for (int i = 0; i < names.size(); i++) {
            int row = i / cols - scroll;
            if (row < 0 || row >= visible) continue;
            String name = names.get(i);
            int x = cx + (i % cols) * (w + 5);
            int y = cy + row * (h + 5);
            add(new MenuButton(x, y, w, h, name, (g, b, hover) -> drawCosmetic(g, b, name, hover), b -> {
                Config.Data d = Config.get();
                d.cosmetic = name;
                Config.save(d);
                Hud.notify(name.isEmpty() ? "Косметика" : name, name.isEmpty() ? "выключена" : "в руке");
            }));
        }
    }

    private void waypoints() {
        Player player = minecraft.player;
        nameBox = add(new EditBox(font, cx, cy, cw - 140, 14, Component.literal("Название точки")));
        nameBox.setHint(Component.literal("Название точки"));
        xBox = add(new EditBox(font, cx + cw - 134, cy, 40, 14, Component.literal("X")));
        yBox = add(new EditBox(font, cx + cw - 90, cy, 30, 14, Component.literal("Y")));
        zBox = add(new EditBox(font, cx + cw - 56, cy, 40, 14, Component.literal("Z")));
        if (player != null) {
            xBox.setValue(String.valueOf((int) Math.floor(player.getX())));
            yBox.setValue(String.valueOf((int) Math.floor(player.getY())));
            zBox.setValue(String.valueOf((int) Math.floor(player.getZ())));
        }
        add(new MenuButton(cx + cw - 14, cy, 14, 14, "+", (g, b, hover) -> drawSmall(g, b, "+", true, hover), b -> addWaypoint()));

        List<Config.Waypoint> list = Config.get().waypoints;
        int rowH = 22;
        int visible = Math.max(1, (ch - 22) / rowH);
        scroll = Math.max(0, Math.min(scroll, list.size() - visible));
        for (int i = 0; i < list.size(); i++) {
            int row = i - scroll;
            if (row < 0 || row >= visible) continue;
            Config.Waypoint w = list.get(i);
            int y = cy + 22 + row * rowH;
            add(new MenuButton(cx + cw - 18, y + 3, 14, 14, "✕", (g, b, hover) -> drawSmall(g, b, "✕", false, hover), b -> {
                Config.Data d = Config.get();
                d.waypoints.remove(w);
                Config.save(d);
                rebuildContent();
            }));
            add(new MenuButton(cx, y, cw, rowH - 2, w.name, (g, b, hover) -> drawRow(g, b, w.name,
                    w.x + " " + w.y + " " + w.z + "  ·  " + shortDim(w.dim), hover), b -> {}));
        }
    }

    private void addWaypoint() {
        if (minecraft.level == null) {
            Hud.notify("Метки", "заходи в мир, чтобы ставить метки");
            return;
        }
        Config.Data d = Config.get();
        Config.Waypoint w = new Config.Waypoint();
        String name = nameBox.getValue().trim();
        w.name = name.isEmpty() ? "Точка " + (d.waypoints.size() + 1) : name;
        try {
            w.x = Integer.parseInt(xBox.getValue().trim());
            w.y = Integer.parseInt(yBox.getValue().trim());
            w.z = Integer.parseInt(zBox.getValue().trim());
        } catch (NumberFormatException e) {
            Hud.notify("Метки", "координаты — целые числа");
            return;
        }
        w.dim = minecraft.level.dimension().toString();
        d.waypoints.add(w);
        Config.save(d);
        Hud.notify(w.name, "метка поставлена");
        rebuildContent();
    }

    private void configs() {
        nameBox = add(new EditBox(font, cx, cy, cw - 70, 14, Component.literal("Название конфига")));
        nameBox.setHint(Component.literal("Название конфига"));
        add(new MenuButton(cx + cw - 64, cy, 64, 14, "Сохранить", (g, b, hover) -> drawSmall(g, b, "Сохранить", true, hover), b -> {
            String name = nameBox.getValue().trim().replaceAll("[^\\p{L}\\p{N} _-]", "");
            if (name.isEmpty()) {
                Hud.notify("Конфиги", "введи название");
                return;
            }
            try {
                Config.saveAs(name);
                Hud.notify(name, "сохранён");
            } catch (Exception e) {
                Hud.notify("Конфиги", "не удалось сохранить");
            }
            rebuildContent();
        }));
        List<String> names = configNames();
        int rowH = 22;
        int visible = Math.max(1, (ch - 22) / rowH);
        scroll = Math.max(0, Math.min(scroll, names.size() - visible));
        for (int i = 0; i < names.size(); i++) {
            int row = i - scroll;
            if (row < 0 || row >= visible) continue;
            String name = names.get(i);
            int y = cy + 22 + row * rowH;
            add(new MenuButton(cx + cw - 18, y + 3, 14, 14, "✕", (g, b, hover) -> drawSmall(g, b, "✕", false, hover), b -> {
                try {
                    Files.deleteIfExists(Config.configsDir().resolve(name + ".json"));
                } catch (Exception ignored) {
                    // Nothing to do; the list shows what is left.
                }
                rebuildContent();
            }));
            add(new MenuButton(cx + cw - 82, y + 3, 60, 14, "Загрузить", (g, b, hover) -> drawSmall(g, b, "Загрузить", true, hover), b -> {
                try {
                    Config.load(name);
                    Hud.notify(name, "загружен");
                } catch (Exception e) {
                    Hud.notify("Конфиги", "не удалось загрузить");
                }
            }));
            add(new MenuButton(cx, y, cw, rowH - 2, name, (g, b, hover) -> drawRow(g, b, name, "конфиг", hover), b -> {}));
        }
    }

    private static List<String> configNames() {
        Path dir = Config.configsDir();
        if (!Files.isDirectory(dir)) return List.of();
        try (Stream<Path> files = Files.list(dir)) {
            return files.map(p -> p.getFileName().toString()).filter(n -> n.endsWith(".json"))
                    .map(n -> n.substring(0, n.length() - 5)).sorted().toList();
        } catch (Exception e) {
            return List.of();
        }
    }

    // ---------- frame ----------

    @Override
    public void render(GuiGraphics g, int mouseX, int mouseY, float partial) {
        if (capturing != null) {
            int key = Keys.anyDown();
            if (key != 0) {
                Config.Data d = Config.get();
                if (key == 256 || key == 259) d.binds.remove(capturing);
                else d.binds.put(capturing, key);
                Config.save(d);
                Modules.Module m = Modules.byId(capturing);
                if (m != null) Hud.notify(m.name(), "бинд: " + Keys.name(d.binds.get(capturing)));
                capturing = null;
            }
        }
        if (minecraft.level != null) g.fill(0, 0, width, height, 0x55000000);
        int accent = Config.accent();
        rounded(g, px, py, pw, ph, 0xE60E1015);
        rounded(g, px + 1, py + 1, 92, ph - 2, 0x60181B22);

        // Sidebar: title, groups and the profile card at the bottom.
        g.drawString(font, Fonts.hud("bi4visual"), px + 10, py + 10, TEXT, false);
        g.drawString(font, Fonts.small("1.2"), px + 12 + font.width(Fonts.hud("bi4visual")), py + 11, accent, false);
        int y = py + 30;
        String[] groups = {"Visual", null, "Other", "Client", null, null, null};
        for (int i = 0; i < groups.length; i++) {
            if (groups[i] != null) {
                g.drawString(font, Fonts.small(groups[i]), px + 10, y + 1, MUTED, false);
                y += 10;
            }
            y += 16;
        }
        String nick = minecraft.player != null ? minecraft.player.getName().getString() : minecraft.getUser().getName();
        rounded(g, px + 6, py + ph - 30, 86, 24, 0xFF161A21);
        rounded(g, px + 10, py + ph - 26, 16, 16, accent);
        g.drawString(font, Fonts.hud(nick.substring(0, 1).toUpperCase()), px + 15, py + ph - 22, 0xFFFFFFFF, false);
        g.drawString(font, Fonts.hud(cut(nick, 58)), px + 30, py + ph - 27 + 3, TEXT, false);
        g.drawString(font, Fonts.small("Free"), px + 30, py + ph - 17 + 2, MUTED, false);

        // Top bar of the content.
        String where = query.isBlank() ? page.title : "Поиск";
        g.drawString(font, Fonts.hud("Activity view"), cx, py + 11, TEXT, false);
        int ax = cx + font.width(Fonts.hud("Activity view  "));
        g.drawString(font, Fonts.hud((query.isBlank() ? page.icon : "⌕") + " " + where), ax, py + 11, accent, false);

        if (page == Page.COSMETICS && query.isBlank() && cosTab.equals("swords") && Cosmetics.names().isEmpty()) {
            centred(g, "Косметики нет: импортируй zip в лаунчере", cy + ch / 2 - 6);
            centred(g, "Настройки → Игра → Косметика", cy + ch / 2 + 6);
        }
        if (page == Page.WAYPOINTS && query.isBlank() && Config.get().waypoints.isEmpty()) {
            centred(g, "Точек пока нет", cy + ch / 2);
        }
        if (page == Page.CONFIGS && query.isBlank() && configNames().isEmpty()) {
            centred(g, "Конфигов пока нет", cy + ch / 2);
        }
        if (query.isBlank() ? false : shownModules().isEmpty()) {
            centred(g, "Ничего не нашлось", cy + ch / 2);
        }
        g.drawString(font, Fonts.small(capturing != null ? "Нажми клавишу для бинда · Esc — убрать"
                : "Правый Shift или Esc — закрыть · колесо — листать"), cx, py + ph - 10, MUTED, false);
        super.render(g, mouseX, mouseY, partial);
    }

    private void centred(GuiGraphics g, String s, int y) {
        g.drawString(font, Fonts.hud(s), cx + (cw - font.width(Fonts.hud(s))) / 2, y, MUTED, false);
    }

    private String cut(String s, int max) {
        if (font.width(Fonts.hud(s)) <= max) return s;
        while (s.length() > 1 && font.width(Fonts.hud(s + "…")) > max) s = s.substring(0, s.length() - 1);
        return s + "…";
    }

    /** Wheel scrolling of the module list (1.20.2+ signature; left without @Override on purpose). */
    public boolean mouseScrolled(double mouseX, double mouseY, double scrollX, double scrollY) {
        if (scrollY != 0) {
            scroll = Math.max(0, scroll + (scrollY < 0 ? 1 : -1));
            rebuildContent();
            return true;
        }
        return false;
    }

    @Override
    public boolean shouldCloseOnEsc() {
        return capturing == null;
    }

    @Override
    public void onClose() {
        capturing = null;
        super.onClose();
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

    private static Font font() {
        return Minecraft.getInstance().font;
    }

    private static void drawSection(GuiGraphics g, Button b, boolean active, boolean hover) {
        if (active || hover) rounded(g, b.getX(), b.getY(), b.getWidth(), b.getHeight(), active ? 0xFF1C212B : 0xFF161A21);
        if (active) g.fill(b.getX(), b.getY() + 4, b.getX() + 2, b.getY() + b.getHeight() - 4, Config.accent());
        g.drawString(font(), Fonts.hud(b.getMessage().getString()), b.getX() + 8, b.getY() + 4, active ? TEXT : 0xFF8E95A6, false);
    }

    private static void drawCard(GuiGraphics g, Button b, Modules.Module m, boolean hover) {
        int x = b.getX(), y = b.getY(), w = b.getWidth(), h = b.getHeight();
        int accent = Config.accent();
        rounded(g, x, y, w, h, hover ? CARD_HOVER : CARD);
        Font font = font();
        boolean on = m.on();
        g.fill(x + 6, y + 8, x + 8, y + 12, on ? accent : 0xFF3A404C);
        g.drawString(font, Fonts.hud(m.name()), x + 12, y + 5, on ? TEXT : 0xFFB4BAC6, false);
        String hint = m.hint();
        int max = w - 18 - 66;
        while (hint.length() > 3 && font.width(Fonts.small(hint)) > max) hint = hint.substring(0, hint.length() - 2);
        if (!hint.equals(m.hint())) hint = hint.trim() + "…";
        g.drawString(font, Fonts.small(hint), x + 12, y + 17, MUTED, false);
        if (m.toggle()) {
            int sx = x + w - 24, sy = y + 8;
            rounded(g, sx, sy, 18, 10, on ? accent : 0xFF2A303B);
            int kx = on ? sx + 10 : sx + 2;
            g.fill(kx, sy + 2, kx + 6, sy + 8, 0xFFFFFFFF);
        } else {
            String state = m.state().apply(Config.get());
            int tw = font.width(Fonts.small(state));
            g.drawString(font, Fonts.small(state), x + w - 6 - tw, y + 9, on ? accent : MUTED, false);
        }
    }

    private static void drawChip(GuiGraphics g, Button b, Modules.Module m, boolean hover) {
        boolean wait = m.id().equals(capturing);
        String label = wait ? "..." : Keys.name(Config.get().binds.get(m.id())).toLowerCase(Locale.ROOT);
        rounded(g, b.getX(), b.getY(), b.getWidth(), b.getHeight(), wait ? Config.accent() : hover ? 0xFF2A303B : 0xFF20242D);
        Font font = font();
        int tw = font.width(Fonts.small(label));
        g.drawString(font, Fonts.small(label), b.getX() + (b.getWidth() - tw) / 2, b.getY() + 2, wait ? 0xFFFFFFFF : MUTED, false);
    }

    private static void drawTheme(GuiGraphics g, Button b, Config.Theme t, boolean hover) {
        int x = b.getX(), y = b.getY(), w = b.getWidth(), h = b.getHeight();
        boolean selected = t.id().equals(Config.get().theme);
        if (selected) rounded(g, x - 1, y - 1, w + 2, h + 2, t.colour());
        rounded(g, x, y, w, h, hover ? CARD_HOVER : CARD);
        g.fillGradient(x + 6, y + 6, x + w - 6, y + 14, t.colour(), t.colour() & 0x80FFFFFF);
        Font font = font();
        g.drawString(font, Fonts.small(t.name()), x + 6, y + 18, selected ? TEXT : 0xFFB4BAC6, false);
        String hex = String.format("#%06X", t.colour() & 0xFFFFFF);
        g.drawString(font, Fonts.small(hex), x + w - 6 - font.width(Fonts.small(hex)), y + 18, MUTED, false);
    }

    private static void drawCosmetic(GuiGraphics g, Button b, String name, boolean hover) {
        int x = b.getX(), y = b.getY(), w = b.getWidth(), h = b.getHeight();
        boolean selected = name.equals(Config.get().cosmetic);
        if (selected) rounded(g, x - 1, y - 1, w + 2, h + 2, Config.accent());
        rounded(g, x, y, w, h, hover ? CARD_HOVER : CARD);
        Font font = font();
        if (name.isEmpty()) {
            String none = "✕";
            g.drawString(font, Fonts.hud(none), x + (w - font.width(Fonts.hud(none))) / 2, y + 10, MUTED, false);
        } else {
            g.renderItem(Cosmetics.preview(name), x + (w - 16) / 2, y + 5);
        }
        String label = name.isEmpty() ? "Без косметики" : name;
        while (label.length() > 3 && font.width(Fonts.small(label)) > w - 6) label = label.substring(0, label.length() - 2);
        if (!label.equals(name) && !name.isEmpty()) label = label.trim() + "…";
        g.drawString(font, Fonts.small(label), x + (w - font.width(Fonts.small(label))) / 2, y + h - 11, selected ? TEXT : 0xFFB4BAC6, false);
    }

    private static void drawTab(GuiGraphics g, Button b, String label, boolean selected, boolean hover) {
        rounded(g, b.getX(), b.getY(), b.getWidth(), b.getHeight(), selected ? Config.accent() : hover ? CARD_HOVER : CARD);
        Font font = font();
        int tw = font.width(Fonts.small(label));
        g.drawString(font, Fonts.small(label), b.getX() + (b.getWidth() - tw) / 2, b.getY() + 3,
                selected ? 0xFFFFFFFF : 0xFFB4BAC6, false);
    }

    private static void drawRow(GuiGraphics g, Button b, String name, String info, boolean hover) {
        int x = b.getX(), y = b.getY(), w = b.getWidth(), h = b.getHeight();
        rounded(g, x, y, w, h, hover ? CARD_HOVER : CARD);
        Font font = font();
        g.fill(x + 6, y + h / 2 - 2, x + 8, y + h / 2 + 2, Config.accent());
        g.drawString(font, Fonts.hud(name), x + 12, y + 3, TEXT, false);
        g.drawString(font, Fonts.small(info), x + 12, y + 12, MUTED, false);
    }

    private static void drawSmall(GuiGraphics g, Button b, String label, boolean primary, boolean hover) {
        int bg = primary ? (hover ? 0xFF9AAAE8 : Config.accent()) : hover ? 0xFF3A2026 : 0xFF20242D;
        rounded(g, b.getX(), b.getY(), b.getWidth(), b.getHeight(), bg);
        Font font = font();
        int tw = font.width(Fonts.small(label));
        g.drawString(font, Fonts.small(label), b.getX() + (b.getWidth() - tw) / 2, b.getY() + (b.getHeight() - 7) / 2,
                primary ? 0xFFFFFFFF : 0xFFE0A0A8, false);
    }

    static void rounded(GuiGraphics g, int x, int y, int w, int h, int c) {
        g.fill(x + 2, y, x + w - 2, y + 1, c);
        g.fill(x + 1, y + 1, x + w - 1, y + 2, c);
        g.fill(x, y + 2, x + w, y + h - 2, c);
        g.fill(x + 1, y + h - 2, x + w - 1, y + h - 1, c);
        g.fill(x + 2, y + h - 1, x + w - 2, y + h, c);
    }

    private static String shortDim(String dim) {
        if (dim.contains("the_nether")) return "Ад";
        if (dim.contains("the_end")) return "Энд";
        if (dim.contains("overworld")) return "Верхний мир";
        return dim;
    }
}
