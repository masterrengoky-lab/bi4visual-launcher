package net.bi4visual.mod;

import net.minecraft.client.gui.Font;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.screens.TitleScreen;
import net.minecraft.client.gui.screens.multiplayer.JoinMultiplayerScreen;
import net.minecraft.client.gui.screens.options.OptionsScreen;
import net.minecraft.client.gui.screens.worldselection.SelectWorldScreen;
import net.minecraft.network.chat.Component;

/**
 * The bi4visual main menu: a greeting and a short column of dark buttons over
 * the blurred panorama. "Обычное меню" opens the vanilla title screen once.
 */
public class MenuScreen extends net.minecraft.client.gui.screens.Screen {
    private static boolean vanilla;

    /** How a button looks; clicks are handled by the vanilla button underneath. */
    public interface Painter {
        void paint(GuiGraphics g, Button b, boolean hover);
    }

    static Painter plain(boolean primary) {
        return (g, b, hover) -> drawButton(g, b, primary, hover);
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
        int bw = 180;
        int bh = 20;
        int x = (width - bw) / 2;
        int y = height / 2 - 30;
        addRenderableWidget(new MenuButton(x, y, bw, bh, "Сетевая игра", plain(false), b -> minecraft.setScreen(new JoinMultiplayerScreen(this))));
        addRenderableWidget(new MenuButton(x, y + 25, bw, bh, "Одиночная игра", plain(true), b -> minecraft.setScreen(new SelectWorldScreen(this))));
        int half = (bw - 5) / 2;
        addRenderableWidget(new MenuButton(x, y + 50, half, bh, "Настройки", plain(false), b -> minecraft.setScreen(new OptionsScreen(this, minecraft.options))));
        addRenderableWidget(new MenuButton(x + bw - half, y + 50, half, bh, "Выход", plain(false), b -> minecraft.stop()));
        addRenderableWidget(new MenuButton(x + (bw - 110) / 2, y + 80, 110, 14, "Обычное меню", plain(false), b -> {
            vanilla = true;
            minecraft.setScreen(new TitleScreen());
        }));
    }

    @Override
    public void render(GuiGraphics g, int mouseX, int mouseY, float partial) {
        super.render(g, mouseX, mouseY, partial);
        int accent = Config.accent();
        Font font = minecraft.font;
        String a = "Добро пожаловать в ";
        String b = "bi4visual";
        int w = font.width(Fonts.hud(a)) + font.width(Fonts.hud(b + "!"));
        int x = (width - w) / 2;
        int y = height / 2 - 62;
        g.drawString(font, Fonts.hud(a), x, y, 0xFFF1F3F8, false);
        g.drawString(font, Fonts.hud(b), x + font.width(Fonts.hud(a)), y, accent, false);
        g.drawString(font, Fonts.hud("!"), x + font.width(Fonts.hud(a + b)), y, 0xFFF1F3F8, false);
        g.drawCenteredString(font, Fonts.hud("Как твой день? Сейчас станет лучше"), width / 2, y + 13, 0xFF8E95A6);
        g.drawString(font, Fonts.hud("bi4visual · визуалы в игре на правый Shift"), 6, height - 12, 0x668E95A6, false);
    }

    @Override
    public boolean shouldCloseOnEsc() {
        return false;
    }

    /** Dark rounded button; the main one and hovered ones take the accent colour. */
    public static void drawButton(GuiGraphics g, Button b, boolean primary, boolean hover) {
        int accent = Config.accent();
        int bg = primary ? (hover ? brighten(accent) : accent) : hover ? 0xE0262A33 : 0xC0181B21;
        int x = b.getX(), y = b.getY(), w = b.getWidth(), h = b.getHeight();
        g.fill(x + 2, y, x + w - 2, y + 1, bg);
        g.fill(x + 1, y + 1, x + w - 1, y + 2, bg);
        g.fill(x, y + 2, x + w, y + h - 2, bg);
        g.fill(x + 1, y + h - 2, x + w - 1, y + h - 1, bg);
        g.fill(x + 2, y + h - 1, x + w - 2, y + h, bg);
        if (!primary && hover) g.fill(x + 2, y + h - 1, x + w - 2, y + h, accent);
        Font font = net.minecraft.client.Minecraft.getInstance().font;
        int color = primary ? 0xFF0E1015 : hover ? 0xFFFFFFFF : 0xFFC9CED9;
        if (primary && (accent & 0xFF) + ((accent >> 8) & 0xFF) + ((accent >> 16) & 0xFF) < 330) color = 0xFFFFFFFF;
        g.drawCenteredString(font, Fonts.hud(b.getMessage().getString()), x + w / 2, y + (h - 8) / 2, color);
    }

    private static int brighten(int argb) {
        int r = Math.min(255, ((argb >> 16) & 0xFF) + 25);
        int gr = Math.min(255, ((argb >> 8) & 0xFF) + 25);
        int bl = Math.min(255, (argb & 0xFF) + 25);
        return 0xFF000000 | (r << 16) | (gr << 8) | bl;
    }
}
