package net.bi4visual.mod;

import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.Font;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.multiplayer.PlayerInfo;
import net.minecraft.world.effect.MobEffectInstance;
import net.minecraft.world.entity.EquipmentSlot;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.ItemStack;

/**
 * The bi4visual HUD: dark rounded panels with a top island (logo, nick, time,
 * FPS, ping, track), active potions, item cooldowns, armour wear and short
 * notifications. Information the vanilla game already shows, only nicer.
 */
public final class Hud {
    private static final int PANEL = 0xD0101318;
    private static final int PANEL_EDGE = 0x22FFFFFF;
    private static final int TEXT = 0xFFF1F3F8;
    private static final int MUTED = 0xFF8E95A6;
    private static final int PAD = 6;
    private static final int ROW = 12;

    private static final List<Toast> toasts = new ArrayList<>();

    private record Toast(String bold, String rest, long born) {}

    private Hud() {}

    /** A line like "Zoom enabled" above the hotbar for a couple of seconds. */
    public static void notify(String bold, String rest) {
        synchronized (toasts) {
            toasts.add(new Toast(bold, rest, System.currentTimeMillis()));
            while (toasts.size() > 3) toasts.remove(0);
        }
    }

    public static void render(GuiGraphics g) {
        Minecraft mc = Minecraft.getInstance();
        Player player = mc.player;
        if (player == null || mc.options.hideGui || !Config.get().hud) {
            return;
        }
        int accent = Config.accent();
        int w = g.guiWidth();
        int h = g.guiHeight();
        Font font = mc.font;

        Config.Data c = Config.get();
        if (c.island) island(g, font, mc, player, w, accent);
        if (c.potions) potions(g, font, player, h, accent);
        if (c.cooldowns) cooldowns(g, font, player, w, h, accent);
        if (c.armour) armour(g, font, player, w, h);
        if (c.toasts) toasts(g, font, w, h, accent);
    }

    // ---------- pieces ----------

    private static void island(GuiGraphics g, Font font, Minecraft mc, Player player, int w, int accent) {
        List<Seg> segs = new ArrayList<>();
        segs.add(new Seg("b4", accent, true));
        segs.add(new Seg(player.getName().getString(), TEXT, false));
        LocalTime now = LocalTime.now();
        segs.add(new Seg("◷ " + now.getHour() + ":" + two(now.getMinute()), TEXT, false));
        segs.add(new Seg(mc.getFps() + " fps", TEXT, false));
        if (mc.getConnection() != null && !mc.hasSingleplayerServer()) {
            PlayerInfo info = mc.getConnection().getPlayerInfo(player.getUUID());
            if (info != null) segs.add(new Seg(info.getLatency() + " ms", TEXT, false));
        }
        NowPlaying.Data np = NowPlaying.get();
        if (np != null && np.playing && !np.title.isBlank()) {
            segs.add(new Seg("♪ " + cut(font, np.title, 120), accent, false));
        }

        int gap = 10;
        int total = 0;
        for (Seg s : segs) total += width(font, s.text) + gap;
        total -= gap;
        int x = (w - total) / 2 - PAD - 2;
        int y = 5;
        panel(g, x, y, total + (PAD + 2) * 2, 18);
        int cx = x + PAD + 2;
        for (int i = 0; i < segs.size(); i++) {
            Seg s = segs.get(i);
            text(g, font, s.text, cx, y + 5, s.color);
            cx += width(font, s.text) + gap;
            if (i > 0 && i < segs.size() - 1) {
                g.fill(cx - gap / 2 - 1, y + 5, cx - gap / 2, y + 13, 0x30FFFFFF);
            }
        }
    }

    private record Seg(String text, int color, boolean bold) {}

    private static void potions(GuiGraphics g, Font font, Player player, int h, int accent) {
        List<MobEffectInstance> effects = new ArrayList<>(player.getActiveEffects());
        if (effects.isEmpty()) return;
        effects.sort((a, b) -> Integer.compare(b.getDuration(), a.getDuration()));
        List<String[]> rows = new ArrayList<>();
        for (MobEffectInstance e : effects) {
            String name = e.getEffect().value().getDisplayName().getString();
            if (e.getAmplifier() > 0) name += " " + roman(e.getAmplifier() + 1);
            rows.add(new String[] {name, e.isInfiniteDuration() ? "∞" : time(e.getDuration() / 20)});
        }
        list(g, font, "Зелья", rows, 8, h / 2 - 20, accent);
    }

    private static void cooldowns(GuiGraphics g, Font font, Player player, int w, int h, int accent) {
        List<String[]> rows = new ArrayList<>();
        List<Float> parts = new ArrayList<>();
        java.util.Set<String> seen = new java.util.HashSet<>();
        for (int i = 0; i < player.getInventory().getContainerSize(); i++) {
            ItemStack stack = player.getInventory().getItem(i);
            if (stack.isEmpty()) continue;
            float left = player.getCooldowns().getCooldownPercent(stack, 0f);
            String name = stack.getHoverName().getString();
            if (left <= 0f || !seen.add(name)) continue;
            rows.add(new String[] {name, Math.round(left * 100) + "%"});
            parts.add(left);
        }
        if (rows.isEmpty()) return;
        int x = w - 8 - listWidth(font, "Кулдауны", rows);
        int y = h / 2 + 30;
        list(g, font, "Кулдауны", rows, x, y, accent);
        int bw = listWidth(font, "", rows) - PAD * 2;
        for (int i = 0; i < parts.size(); i++) {
            int by = y + 18 + i * ROW + 9;
            g.fill(x + PAD, by, x + PAD + Math.round(bw * parts.get(i)), by + 1, accent);
        }
    }

    private static void armour(GuiGraphics g, Font font, Player player, int w, int h) {
        EquipmentSlot[] slots = {EquipmentSlot.HEAD, EquipmentSlot.CHEST, EquipmentSlot.LEGS, EquipmentSlot.FEET};
        List<ItemStack> worn = new ArrayList<>();
        for (EquipmentSlot s : slots) {
            ItemStack st = player.getItemBySlot(s);
            if (!st.isEmpty()) worn.add(st);
        }
        if (worn.isEmpty()) return;
        int pw = 52;
        int ph = worn.size() * 18 + 4;
        int x = w - pw - 8;
        int y = h / 2 - ph - 10;
        panel(g, x, y, pw, ph);
        for (int i = 0; i < worn.size(); i++) {
            ItemStack st = worn.get(i);
            int iy = y + 2 + i * 18;
            g.renderItem(st, x + 3, iy + 1);
            String pct = st.isDamageableItem()
                    ? Math.round(100f * (st.getMaxDamage() - st.getDamageValue()) / st.getMaxDamage()) + "%"
                    : "—";
            int color = !st.isDamageableItem() ? MUTED : st.getDamageValue() * 4 > st.getMaxDamage() * 3 ? 0xFFF87171 : TEXT;
            text(g, font, pct, x + 22, iy + 6, color);
        }
    }

    private static void toasts(GuiGraphics g, Font font, int w, int h, int accent) {
        long now = System.currentTimeMillis();
        List<Toast> list;
        synchronized (toasts) {
            toasts.removeIf(t -> now - t.born > 2600);
            list = new ArrayList<>(toasts);
        }
        int y = h - 72;
        for (int i = list.size() - 1; i >= 0; i--) {
            Toast t = list.get(i);
            float age = (now - t.born) / 2600f;
            int alpha = (int) (255 * Math.min(1f, Math.min(age * 8f, (1f - age) * 5f)));
            if (alpha < 8) continue;
            int tw = width(font, t.bold) + width(font, " " + t.rest);
            int x = (w - tw) / 2 - PAD;
            panelA(g, x, y, tw + PAD * 2 + 10, 16, alpha);
            text(g, font, t.bold, x + PAD, y + 4, withAlpha(TEXT, alpha));
            text(g, font, " " + t.rest, x + PAD + width(font, t.bold), y + 4, withAlpha(MUTED, alpha));
            g.fill(x + tw + PAD + 4, y + 6, x + tw + PAD + 7, y + 9, withAlpha(accent, alpha));
            y -= 19;
        }
    }

    // ---------- drawing helpers ----------

    /** A titled list: name on the left, value on the right. */
    private static void list(GuiGraphics g, Font font, String title, List<String[]> rows, int x, int y, int accent) {
        int pw = listWidth(font, title, rows);
        int ph = 18 + rows.size() * ROW + 2;
        panel(g, x, y, pw, ph);
        text(g, font, title, x + PAD, y + 5, TEXT);
        g.fill(x + pw - PAD - 4, y + 6, x + pw - PAD, y + 10, accent);
        g.fill(x + PAD, y + 15, x + pw - PAD, y + 16, 0x18FFFFFF);
        for (int i = 0; i < rows.size(); i++) {
            int ry = y + 19 + i * ROW;
            g.fill(x + PAD, ry + 2, x + PAD + 2, ry + 6, accent);
            text(g, font, rows.get(i)[0], x + PAD + 5, ry, TEXT);
            String v = rows.get(i)[1];
            text(g, font, v, x + pw - PAD - width(font, v), ry, MUTED);
        }
    }

    private static int listWidth(Font font, String title, List<String[]> rows) {
        int max = width(font, title) + 14;
        for (String[] r : rows) max = Math.max(max, width(font, r[0]) + width(font, r[1]) + 16);
        return Math.max(90, max + PAD * 2);
    }

    /** A dark panel with rounded corners and a faint top edge. */
    private static void panel(GuiGraphics g, int x, int y, int w, int h) {
        panelA(g, x, y, w, h, 255);
    }

    private static void panelA(GuiGraphics g, int x, int y, int w, int h, int alpha) {
        int bg = withAlpha(PANEL, (PANEL >>> 24) * alpha / 255);
        g.fill(x + 2, y, x + w - 2, y + 1, bg);
        g.fill(x + 1, y + 1, x + w - 1, y + 2, bg);
        g.fill(x, y + 2, x + w, y + h - 2, bg);
        g.fill(x + 1, y + h - 2, x + w - 1, y + h - 1, bg);
        g.fill(x + 2, y + h - 1, x + w - 2, y + h, bg);
        g.fill(x + 2, y, x + w - 2, y + 1, withAlpha(PANEL_EDGE, (PANEL_EDGE >>> 24) * alpha / 255));
    }

    private static void text(GuiGraphics g, Font font, String s, int x, int y, int color) {
        g.drawString(font, Fonts.hud(s), x, y, color, false);
    }

    private static int width(Font font, String s) {
        return font.width(Fonts.hud(s));
    }

    private static int withAlpha(int argb, int alpha) {
        return (Math.max(0, Math.min(255, alpha)) << 24) | (argb & 0xFFFFFF);
    }

    private static String cut(Font font, String s, int max) {
        if (width(font, s) <= max) return s;
        while (s.length() > 1 && width(font, s + "…") > max) s = s.substring(0, s.length() - 1);
        return s + "…";
    }

    private static String two(int n) {
        return n < 10 ? "0" + n : String.valueOf(n);
    }

    private static String time(int secs) {
        return secs / 60 + ":" + two(secs % 60);
    }

    private static String roman(int n) {
        String[] r = {"I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"};
        return n >= 1 && n <= 10 ? r[n - 1] : String.valueOf(n);
    }
}
