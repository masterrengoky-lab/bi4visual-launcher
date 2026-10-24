package net.bi4visual.mod;

import java.util.List;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.Font;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.screens.TitleScreen;
import net.minecraft.client.gui.screens.multiplayer.JoinMultiplayerScreen;
import net.minecraft.client.gui.screens.options.OptionsScreen;
import net.minecraft.client.gui.screens.worldselection.SelectWorldScreen;
import net.minecraft.network.chat.Component;

/**
 * The bi4visual main menu: a greeting over the darkened, blurred panorama, a
 * compact column of buttons with the label on the left and an icon on the
 * right, two round icon buttons in the top right corner (menu background and
 * visuals) and a short footer. "Обычное меню" opens the vanilla title once.
 */
public class MenuScreen extends net.minecraft.client.gui.screens.Screen {
    private static final int TEXT = 0xFFF1F3F8;
    private static final int LABEL = 0xFFC4C8D2;
    private static final int MUTED = 0xFF7B8190;
    private static final int BUTTON = 0xB0121418;
    private static final int BUTTON_HOVER = 0xC81D2026;
    private static final int LIGHT = 0xFFB4C0F2;

    /** A background tint: a vertical gradient laid over the panorama. */
    private record Background(String id, String name, int top, int bottom) {}

    private static final List<Background> BACKGROUNDS = List.of(
            new Background("forest", "Лес", 0xFF0E2016, 0xFF050A07),
            new Background("sunset", "Закат", 0xFF4A2A1A, 0xFF120A12),
            new Background("ocean", "Океан", 0xFF0E2A44, 0xFF040A14),
            new Background("sakura", "Сакура", 0xFF4A2442, 0xFF120A16),
            new Background("night", "Ночь", 0xFF141A3A, 0xFF05060E),
            new Background("ash", "Пепел", 0xFF26282C, 0xFF0A0B0D),
            new Background("nether", "Незер", 0xFF3E1010, 0xFF100404),
            new Background("end", "Энд", 0xFF2A1E44, 0xFF08060E));

    // Pixel icons, '#' is a filled pixel.
    private static final String[] ICON_PLAYERS = {".##.....", ".##..##.", ".....##.", "####....", "####.###"};
    private static final String[] ICON_PLAYER = {".##.", ".##.", "....", "####", "####"};
    private static final String[] ICON_GRID = {"##.##", "##.##", ".....", "##.##", "##.##"};
    private static final String[] ICON_GEAR = {"..#..", ".###.", "##.##", ".###.", "..#.."};
    private static final String[] ICON_EXIT = {"#...#", ".#.#.", "..#..", ".#.#.", "#...#"};
    private static final String[] ICON_PICTURE = {"#######", "#.....#", "#..#..#", "#.###.#", "#######"};
    private static final String[] ICON_BACK = {"..#..", ".#...", "#####", ".#...", "..#.."};

    private static boolean vanilla;
    private static boolean backgroundsOpen;
    private int mouseX;

    /** How a button looks; clicks are handled by the vanilla button underneath. */
    public interface Painter {
        void paint(GuiGraphics g, Button b, boolean hover);
    }

    public MenuScreen() {
        super(Component.literal("bi4visual"));
    }

    /** True once after the player asked for the vanilla menu. */
    public static boolean vanillaOnce() {
        boolean v = vanilla;
        vanilla = false;
        return v;
    }

    @Override
    protected void init() {
        int cx = width / 2;
        int cy = height / 2;
        addRenderableWidget(new MenuButton(width - 31, 11, 20, 20, "Фон меню",
                (g, b, hover) -> drawRound(g, b, ICON_PICTURE, hover || backgroundsOpen), b -> toggleBackgrounds()));
        addRenderableWidget(new MenuButton(width - 31, 38, 20, 20, "Визуалы",
                (g, b, hover) -> drawRound(g, b, ICON_GRID, hover), b -> minecraft.setScreen(new ModulesScreen())));
        if (backgroundsOpen) {
            initBackgrounds(cx, cy);
            return;
        }

        int bw = 174;
        int bh = 18;
        int x = cx - bw / 2;
        int y = cy - 23;
        addRenderableWidget(new MenuButton(x, y, bw, bh, "Сетевая игра", row(ICON_PLAYERS, false),
                b -> minecraft.setScreen(new JoinMultiplayerScreen(this))));
        addRenderableWidget(new MenuButton(x, y + 27, bw, bh, "Одиночная игра", row(ICON_PLAYER, true),
                b -> minecraft.setScreen(new SelectWorldScreen(this))));
        addRenderableWidget(new MenuButton(x, y + 54, bw, bh, "Визуалы bi4visual", row(ICON_GRID, false),
                b -> minecraft.setScreen(new ModulesScreen())));
        int half = (bw - 6) / 2;
        addRenderableWidget(new MenuButton(x, y + 81, half, bh, "Настройки", row(ICON_GEAR, false),
                b -> minecraft.setScreen(new OptionsScreen(this, minecraft.options))));
        addRenderableWidget(new MenuButton(x + bw - half, y + 81, half, bh, "Выход", row(ICON_EXIT, false),
                b -> minecraft.stop()));

        String plain = "Обычное меню";
        int pw = minecraft.font.width(Fonts.small(plain)) + 12;
        addRenderableWidget(new MenuButton(width - pw - 10, height - 22, pw, 13, plain, (g, b, hover) -> {
            if (hover) ModulesScreen.rounded(g, b.getX(), b.getY(), b.getWidth(), b.getHeight(), BUTTON);
            g.drawString(minecraft.font, Fonts.small(plain), b.getX() + 6, b.getY() + 3, hover ? LABEL : MUTED, false);
        }, b -> {
            vanilla = true;
            minecraft.setScreen(new TitleScreen());
        }));
    }

    /** The "Фон меню" panel: eight tints in two rows, then blur and darkness sliders. */
    private void initBackgrounds(int cx, int cy) {
        int pw = 350;
        int ph = 180;
        int px = cx - pw / 2;
        int py = cy - ph / 2;
        int tw = 78;
        int th = 44;
        for (int i = 0; i < BACKGROUNDS.size(); i++) {
            Background bg = BACKGROUNDS.get(i);
            int x = px + 10 + (i % 4) * (tw + 6);
            int y = py + 26 + (i / 4) * (th + 6);
            addRenderableWidget(new MenuButton(x, y, tw, th, bg.name, (g, b, hover) -> drawTile(g, b, bg, hover), b -> {
                Config.Data d = Config.get();
                d.menuBg = bg.id;
                Config.save(d);
            }));
        }
        int sx = px + 10;
        int sw = pw - 20;
        addRenderableWidget(new MenuButton(sx, py + 137, sw, 8, "Блюр фона", (g, b, hover) -> drawSlider(g, b, blur() * 10, hover), b -> {
            int v = Math.round(10f * fraction(b));
            minecraft.options.menuBackgroundBlurriness().set(v);
            minecraft.options.save();
        }));
        addRenderableWidget(new MenuButton(sx, py + 162, sw, 8, "Затемнение", (g, b, hover) -> drawSlider(g, b, Config.get().menuDim, hover), b -> {
            Config.Data d = Config.get();
            d.menuDim = Math.round(100f * fraction(b));
            Config.save(d);
        }));
        // A click anywhere outside the panel closes it; added last so the panel gets clicks first.
        addRenderableWidget(new MenuButton(0, 0, width, height, "Закрыть", (g, b, hover) -> {}, b -> toggleBackgrounds()));
    }

    private void toggleBackgrounds() {
        backgroundsOpen = !backgroundsOpen;
        rebuildWidgets();
    }

    private float fraction(Button b) {
        return Math.max(0f, Math.min(1f, (mouseX - b.getX()) / (float) b.getWidth()));
    }

    private int blur() {
        return minecraft.options.menuBackgroundBlurriness().get();
    }

    @Override
    public void renderBackground(GuiGraphics g, int mouseX, int mouseY, float partial) {
        super.renderBackground(g, mouseX, mouseY, partial);
        Background bg = background();
        int dim = Math.max(0, Math.min(100, Config.get().menuDim));
        int alpha = 70 + dim * 150 / 100;
        g.fillGradient(0, 0, width, height, withAlpha(bg.top, alpha), withAlpha(bg.bottom, Math.min(255, alpha + 30)));
        if (backgroundsOpen) {
            ModulesScreen.rounded(g, width / 2 - 175, height / 2 - 90, 350, 180, 0xE6101216);
        }
    }

    @Override
    public void render(GuiGraphics g, int mouseX, int mouseY, float partial) {
        this.mouseX = mouseX;
        super.render(g, mouseX, mouseY, partial);
        Font font = minecraft.font;
        int cx = width / 2;
        int cy = height / 2;
        if (backgroundsOpen) {
            int pw = 350;
            int px = cx - pw / 2;
            int py = cy - 90;
            g.drawString(font, Fonts.hud("Фон меню"), px + 10, py + 9, TEXT, false);
            label(g, font, px, py + 126, pw, "Блюр фона", blur() * 10 + "%");
            label(g, font, px, py + 150, pw, "Затемнение", Config.get().menuDim + "%");
        } else {
            String a = "Добро пожаловать в ";
            String b1 = "bi4";
            String b2 = "visual";
            int wa = font.width(Fonts.title(a));
            int w1 = font.width(Fonts.title(b1));
            int w2 = font.width(Fonts.title(b2));
            int total = wa + w1 + w2 + font.width(Fonts.title("!"));
            int x = cx - total / 2;
            int y = cy - 64;
            g.drawString(font, Fonts.title(a), x, y, TEXT, false);
            g.drawString(font, Fonts.title(b1), x + wa, y, Config.accent(), false);
            g.drawString(font, Fonts.title(b2), x + wa + w1, y, LIGHT, false);
            g.drawString(font, Fonts.title("!"), x + wa + w1 + w2, y, TEXT, false);
            String sub = "Как твой день? Сейчас станет лучше!";
            g.drawString(font, Fonts.small(sub), cx - font.width(Fonts.small(sub)) / 2, cy - 38, MUTED, false);
        }
        g.drawString(font, Fonts.small("Сделано с любовью · bi4visual"), 30, height - 25, MUTED, false);
    }

    @Override
    public boolean shouldCloseOnEsc() {
        return false;
    }

    // ---------- drawing ----------

    private static Background background() {
        String id = Config.get().menuBg;
        for (Background bg : BACKGROUNDS) {
            if (bg.id.equals(id)) return bg;
        }
        return BACKGROUNDS.get(0);
    }

    private static Painter row(String[] icon, boolean primary) {
        return (g, b, hover) -> drawRow(g, b, icon, primary, hover);
    }

    /** A dark button with the label on the left and a small icon on the right; the main one is periwinkle. */
    private static void drawRow(GuiGraphics g, Button b, String[] icon, boolean primary, boolean hover) {
        int x = b.getX(), y = b.getY(), w = b.getWidth(), h = b.getHeight();
        int bg = primary ? (hover ? 0xFF93A4E6 : Config.accent()) : hover ? BUTTON_HOVER : BUTTON;
        ModulesScreen.rounded(g, x, y, w, h, bg);
        Font font = Minecraft.getInstance().font;
        int color = primary || hover ? 0xFFFFFFFF : LABEL;
        g.drawString(font, Fonts.hud(b.getMessage().getString()), x + 8, y + (h - 8) / 2, color, false);
        int iw = icon[0].length();
        icon(g, icon, x + w - 9 - iw, y + (h - icon.length) / 2, primary ? 0xFFFFFFFF : 0xFF9AA0AE);
    }

    /** A small periwinkle square with a white icon, top right. */
    private static void drawRound(GuiGraphics g, Button b, String[] icon, boolean active) {
        int x = b.getX(), y = b.getY(), w = b.getWidth(), h = b.getHeight();
        ModulesScreen.rounded(g, x, y, w, h, active ? 0xFF93A4E6 : Config.accent());
        icon(g, icon, x + (w - icon[0].length()) / 2, y + (h - icon.length) / 2, 0xFFFFFFFF);
    }

    private static void drawTile(GuiGraphics g, Button b, Background bg, boolean hover) {
        int x = b.getX(), y = b.getY(), w = b.getWidth(), h = b.getHeight();
        boolean selected = bg == background();
        if (selected) ModulesScreen.rounded(g, x - 1, y - 1, w + 2, h + 2, Config.accent());
        g.fillGradient(x + 1, y + 1, x + w - 1, y + h - 1, brighten(bg.top, 40), bg.bottom);
        if (hover && !selected) g.fill(x + 1, y + 1, x + w - 1, y + h - 1, 0x18FFFFFF);
        Font font = Minecraft.getInstance().font;
        g.drawString(font, Fonts.small(bg.name), x + 6, y + h - 12, selected ? 0xFFFFFFFF : LABEL, false);
    }

    private static void drawSlider(GuiGraphics g, Button b, int percent, boolean hover) {
        int x = b.getX(), y = b.getY(), w = b.getWidth();
        int mid = y + 4;
        g.fill(x, mid - 1, x + w, mid + 1, 0xFF262A33);
        int fill = Math.round(w * Math.max(0, Math.min(100, percent)) / 100f);
        g.fill(x, mid - 1, x + fill, mid + 1, Config.accent());
        int kx = Math.max(x, Math.min(x + w - 6, x + fill - 3));
        ModulesScreen.rounded(g, kx, y + 1, 6, 6, hover ? 0xFFFFFFFF : 0xFFE4E8F5);
    }

    private static void label(GuiGraphics g, Font font, int px, int y, int pw, String name, String value) {
        g.drawString(font, Fonts.small(name), px + 10, y, LABEL, false);
        g.drawString(font, Fonts.small(value), px + pw - 10 - font.width(Fonts.small(value)), y, MUTED, false);
    }

    private static void icon(GuiGraphics g, String[] rows, int x, int y, int color) {
        for (int r = 0; r < rows.length; r++) {
            for (int c = 0; c < rows[r].length(); c++) {
                if (rows[r].charAt(c) == '#') g.fill(x + c, y + r, x + c + 1, y + r + 1, color);
            }
        }
    }

    private static int withAlpha(int argb, int alpha) {
        return (Math.max(0, Math.min(255, alpha)) << 24) | (argb & 0xFFFFFF);
    }

    private static int brighten(int argb, int by) {
        int r = Math.min(255, ((argb >> 16) & 0xFF) + by);
        int gr = Math.min(255, ((argb >> 8) & 0xFF) + by);
        int bl = Math.min(255, (argb & 0xFF) + by);
        return 0xFF000000 | (r << 16) | (gr << 8) | bl;
    }
}
