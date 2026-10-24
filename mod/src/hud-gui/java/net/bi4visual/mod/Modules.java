package net.bi4visual.mod;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;
import java.util.function.Function;
import net.minecraft.client.Minecraft;
import net.minecraft.core.particles.ParticleTypes;
import net.minecraft.util.Mth;
import net.minecraft.world.entity.player.Player;

/**
 * Every switchable thing of the mod in one list: the Right Shift menu shows it,
 * binds toggle it, and the per-frame work (binds, snow, jump rings) runs here.
 */
public final class Modules {
    public enum Category {
        RENDER("Render"), INTERFACE("Interface"), UTILITY("Utility");

        public final String title;

        Category(String title) {
            this.title = title;
        }
    }

    /** One module: its state as text ("вкл", "выкл" or a value) and what a click does. */
    public record Module(String id, String name, String hint, Category category,
                         Function<Config.Data, String> state, Consumer<Config.Data> click) {
        public boolean toggle() {
            String s = state.apply(Config.get());
            return s.equals("вкл") || s.equals("выкл");
        }

        public boolean on() {
            return !state.apply(Config.get()).equals("выкл");
        }
    }

    private interface Getter {
        boolean get(Config.Data d);
    }

    private interface Setter {
        void set(Config.Data d, boolean v);
    }

    private static Module onOff(String id, String name, String hint, Category c, Getter get, Setter set) {
        return new Module(id, name, hint, c, d -> get.get(d) ? "вкл" : "выкл", d -> set.set(d, !get.get(d)));
    }

    private static Module cycle(String id, String name, String hint, Category c,
                                Function<Config.Data, String> get, java.util.function.BiConsumer<Config.Data, String> set,
                                String[] values, String[] names) {
        return new Module(id, name, hint, c, d -> {
            String v = get.apply(d);
            for (int i = 0; i < values.length; i++) {
                if (values[i].equals(v)) return names[i];
            }
            return names[0];
        }, d -> {
            String v = get.apply(d);
            int i = 0;
            while (i < values.length && !values[i].equals(v)) i++;
            set.accept(d, values[(i + 1) % values.length]);
        });
    }

    public static final List<Module> ALL = List.of(
            // Render
            onOff("lyrics", "Текст песен", "Слова играющей песни в мире", Category.RENDER, d -> d.lyrics, (d, v) -> d.lyrics = v),
            cycle("sky", "Небо", "Галактика и северное сияние ночью", Category.RENDER, d -> d.sky, (d, v) -> d.sky = v,
                    new String[] {"galaxy", "aurora", "both", "off"}, new String[] {"Галактика", "Сияние", "Оба", "выкл"}),
            onOff("night", "Вечная ночь", "Только у тебя, сервер не трогаем", Category.RENDER, d -> d.night, (d, v) -> d.night = v),
            onOff("fullbright", "FullBright", "Светло даже ночью и в пещерах", Category.RENDER, d -> d.fullbright, (d, v) -> d.fullbright = v),
            onOff("zoom", "Zoom", "Приближение, пока держишь клавишу бинда", Category.RENDER, d -> d.zoom, (d, v) -> d.zoom = v),
            cycle("crosshair", "Crosshair", "Свой прицел вместо обычного", Category.RENDER, d -> d.crosshair, (d, v) -> d.crosshair = v,
                    new String[] {"off", "dot", "plus", "circle"}, new String[] {"выкл", "Точка", "Плюс", "Круг"}),
            onOff("handGlow", "HandGlow", "Прозрачная светящаяся рука (1.21.4–1.21.8)", Category.RENDER, d -> d.handGlow, (d, v) -> d.handGlow = v),
            onOff("jumpCircles", "JumpCircle", "Круги на земле, где ты прыгнул", Category.RENDER, d -> d.jumpCircles, (d, v) -> d.jumpCircles = v),
            onOff("trails", "Trails", "Светящийся след за тобой", Category.RENDER, d -> d.trails, (d, v) -> d.trails = v),
            cycle("atmosphere", "Atmosphere", "Падающий снег вокруг тебя", Category.RENDER, d -> d.atmosphere, (d, v) -> d.atmosphere = v,
                    new String[] {"off", "light", "medium", "heavy"}, new String[] {"выкл", "Слабый", "Средний", "Сильный"}),
            // Interface
            onOff("hud", "HUD", "Все панели bi4visual", Category.INTERFACE, d -> d.hud, (d, v) -> d.hud = v),
            onOff("island", "Watermark", "Ник, время, FPS, пинг и трек сверху", Category.INTERFACE, d -> d.island, (d, v) -> d.island = v),
            onOff("potions", "Potions", "Активные эффекты и сколько осталось", Category.INTERFACE, d -> d.potions, (d, v) -> d.potions = v),
            onOff("cooldowns", "Cooldowns", "Перезарядка жемчуга, хоруса и других", Category.INTERFACE, d -> d.cooldowns, (d, v) -> d.cooldowns = v),
            onOff("armour", "ArmorHUD", "Прочность надетой брони", Category.INTERFACE, d -> d.armour, (d, v) -> d.armour = v),
            onOff("inventory", "InventoryHUD", "Что лежит в инвентаре", Category.INTERFACE, d -> d.inventory, (d, v) -> d.inventory = v),
            onOff("coords", "Coordinates", "Координаты и они же в аду", Category.INTERFACE, d -> d.coords, (d, v) -> d.coords = v),
            onOff("keybinds", "KeyBinds", "Список модулей с биндами", Category.INTERFACE, d -> d.keybinds, (d, v) -> d.keybinds = v),
            onOff("media", "MediaPlayer", "Карточка играющего трека", Category.INTERFACE, d -> d.media, (d, v) -> d.media = v),
            onOff("toasts", "Notifications", "Сообщения о включении модулей", Category.INTERFACE, d -> d.toasts, (d, v) -> d.toasts = v),
            onOff("menu", "MainMenu", "Своё главное меню вместо обычного", Category.INTERFACE, d -> d.menu, (d, v) -> d.menu = v),
            // Utility
            onOff("commandFix", "CommandFix", "Команда в русской раскладке: .рщьу → /home", Category.UTILITY, d -> d.commandFix, (d, v) -> d.commandFix = v),
            onOff("hitSound", "HitSound", "Звук, когда ты бьёшь", Category.UTILITY, d -> d.hitSound, (d, v) -> d.hitSound = v));

    private Modules() {}

    /** Called once at start through reflection from Bi4visualClient. */
    public static void init() {
        Lyrics3D.layer = World3D::render;
    }

    public static Module byId(String id) {
        for (Module m : ALL) {
            if (m.id.equals(id)) return m;
        }
        return null;
    }

    /** Clicks a module as if in the menu: saves and tells the player. */
    public static void click(Module m) {
        Config.Data d = Config.get();
        m.click.accept(d);
        Config.save(d);
        String state = m.state.apply(d);
        Hud.notify(m.name, state.equals("вкл") ? "включён" : state.equals("выкл") ? "выключен" : "— " + state);
    }

    public static List<Module> in(Category c) {
        List<Module> out = new ArrayList<>();
        for (Module m : ALL) {
            if (m.category == c) out.add(m);
        }
        return out;
    }

    /** True while zoom is on and its key is held, with no screen open. */
    public static boolean zooming() {
        Minecraft mc = Minecraft.getInstance();
        Config.Data d = Config.get();
        return d.zoom && mc.screen == null && Keys.down(d.binds.getOrDefault("zoom", 0));
    }

    private static boolean wasOnGround = true;
    private static long lastSnow;

    /** Once a frame from the HUD hook: binds, snow and jump detection. */
    public static void frame() {
        Minecraft mc = Minecraft.getInstance();
        Player player = mc.player;
        if (player == null || mc.level == null) return;
        Config.Data d = Config.get();

        if (mc.screen == null && !ModulesScreen.capturing()) {
            for (var e : d.binds.entrySet()) {
                if (e.getKey().equals("zoom")) continue;
                if (Keys.pressed(e.getValue())) {
                    Module m = byId(e.getKey());
                    if (m != null) click(m);
                }
            }
        }

        boolean onGround = player.onGround();
        if (wasOnGround && !onGround && player.getDeltaMovement().y > 0.2) {
            World3D.jumped(player.getX(), player.getY(), player.getZ());
        }
        wasOnGround = onGround;
        World3D.track(player.getX(), player.getY(), player.getZ());

        int perSecond = switch (d.atmosphere) {
            case "light" -> 60;
            case "medium" -> 160;
            case "heavy" -> 360;
            default -> 0;
        };
        long now = System.currentTimeMillis();
        if (perSecond > 0 && !mc.isPaused()) {
            long elapsed = Math.min(200, now - lastSnow);
            int count = (int) (perSecond * elapsed / 1000);
            if (count > 0) {
                lastSnow = now;
                var random = player.getRandom();
                for (int i = 0; i < count; i++) {
                    double angle = random.nextDouble() * Math.PI * 2;
                    double dist = 1.5 + random.nextDouble() * 14;
                    double x = player.getX() + Math.cos(angle) * dist;
                    double z = player.getZ() + Math.sin(angle) * dist;
                    double y = player.getY() + 4 + random.nextDouble() * 10;
                    mc.level.addParticle(ParticleTypes.SNOWFLAKE, x, y, z,
                            (random.nextDouble() - 0.5) * 0.05, -0.05 - random.nextDouble() * 0.05, (random.nextDouble() - 0.5) * 0.05);
                }
            }
        } else {
            lastSnow = now;
        }
    }

    /** ".рщьу" typed with the Russian layout back to "home"; null when the text is not such a command. */
    public static String fixCommand(String message) {
        if (message.length() < 2 || message.charAt(0) != '.') return null;
        char first = message.charAt(1);
        if (!(first >= 'а' && first <= 'я' || first >= 'А' && first <= 'Я' || first == 'ё' || first == 'Ё')) return null;
        String ru = "йцукенгшщзхъфывапролджэячсмитьбю.ёЙЦУКЕНГШЩЗХЪФЫВАПРОЛДЖЭЯЧСМИТЬБЮ,Ё";
        String en = "qwertyuiop[]asdfghjkl;'zxcvbnm,./`QWERTYUIOP{}ASDFGHJKL:\"ZXCVBNM<>?~";
        StringBuilder out = new StringBuilder();
        for (char ch : message.substring(1).toCharArray()) {
            int i = ru.indexOf(ch);
            out.append(i >= 0 ? en.charAt(i) : ch);
        }
        return out.toString();
    }

    static float clamp01(float v) {
        return Mth.clamp(v, 0f, 1f);
    }
}
