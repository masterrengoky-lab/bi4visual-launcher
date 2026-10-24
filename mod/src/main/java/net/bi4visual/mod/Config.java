package net.bi4visual.mod;

import com.google.gson.Gson;
import java.io.Reader;
import java.nio.file.Files;
import java.nio.file.Path;
import net.fabricmc.loader.api.FabricLoader;

/** Visual settings (bi4visual/config.json), re-read when the file changes. */
public final class Config {
    public static final class Data {
        /** "galaxy", "aurora", "both" or "off". */
        public String sky = "galaxy";
        /** Keep the client at midnight. */
        public boolean night = true;
        /** Song lyrics floating in the world. */
        public boolean lyrics = true;
        /** The bi4visual HUD panels, all together and one by one. */
        public boolean hud = true;
        public boolean island = true;
        public boolean potions = true;
        public boolean cooldowns = true;
        public boolean armour = true;
        public boolean toasts = true;
        /** Own main menu instead of the vanilla title screen. */
        public boolean menu = true;
        /** Render: brighter world, zoom on a held key, own crosshair ("off", "dot", "plus", "circle"). */
        public boolean fullbright = false;
        public boolean zoom = true;
        public String crosshair = "off";
        /** Rings on the ground where the player jumps, a fading trail behind them, falling snow ("off", "light", "medium", "heavy"). */
        public boolean jumpCircles = true;
        /** See-through first-person arm with a soft glow in the theme colour. */
        public boolean handGlow = false;
        /** HMI: item in hand sways behind the view and breathes: off, soft or strong. */
        public String hmi = "off";
        /** Own player only: size of the model, an outline in the theme colour, and things drawn around it. */
        public String model = "normal";
        public boolean outline = false;
        public boolean halo = false;
        public boolean aura = false;
        public boolean orbit = false;
        public boolean trails = false;
        public String atmosphere = "off";
        /** Interface panels: inventory contents, coordinates, module binds, playing track. */
        public boolean inventory = false;
        public boolean coords = true;
        public boolean keybinds = true;
        public boolean media = true;
        /** Utility: ".рщьу" typed in the Russian layout becomes "/home"; a click sound on hits. */
        public boolean commandFix = true;
        public boolean hitSound = false;
        /** The sword model shown in the player's hands, by its name in the cosmetics pack; empty for none. */
        public String cosmetic = "";
        /** Colour theme for the menus and the HUD (see Themes). */
        public String theme = "violet";
        /** Module id to GLFW key code. Zoom is held, the rest toggle. */
        public java.util.Map<String, Integer> binds = new java.util.HashMap<>(java.util.Map.of("zoom", 67));
        public java.util.List<Waypoint> waypoints = new java.util.ArrayList<>();
        /** Main menu background tint (see MenuScreen.BACKGROUNDS) and how dark it is, 0–100. */
        public String menuBg = "forest";
        public int menuDim = 55;
    }

    public static final class Waypoint {
        public String name = "";
        public int x;
        public int y;
        public int z;
        /** The level the point belongs to, from ResourceKey#toString. */
        public String dim = "";
    }

    private static final Gson GSON = new com.google.gson.GsonBuilder().setPrettyPrinting().create();
    private static volatile Data current = new Data();
    private static long seenStamp = -1;
    private static long checkedAt;

    private Config() {}

    public static Data get() {
        long now = System.currentTimeMillis();
        if (now - checkedAt > 1000) {
            checkedAt = now;
            reload();
        }
        return current;
    }

    public record Theme(String id, String name, int colour) {}

    public static final java.util.List<Theme> THEMES = java.util.List.of(
            new Theme("violet", "Violet", 0xFF8597DC),
            new Theme("orchid", "Orchid", 0xFFB07CDB),
            new Theme("rose", "Rose", 0xFFE07A9A),
            new Theme("cherry", "Cherry", 0xFFE0566B),
            new Theme("coral", "Coral", 0xFFF08A6C),
            new Theme("peach", "Peach", 0xFFF4A97F),
            new Theme("amber", "Amber", 0xFFF0B04A),
            new Theme("gold", "Gold", 0xFFE6CB5A),
            new Theme("mint", "Mint", 0xFF6CD9A8),
            new Theme("ocean", "Ocean", 0xFF4FB3E8),
            new Theme("sky", "Sky", 0xFF7CC4F5),
            new Theme("snow", "Snow", 0xFFD6DCE8));

    /** The highlight colour of the chosen theme, used across the menus and the HUD. */
    public static int accent() {
        String id = get().theme;
        for (Theme t : THEMES) {
            if (t.id.equals(id)) return t.colour;
        }
        return 0xFF8597DC;
    }

    /** Where named copies of the settings are kept. */
    public static Path configsDir() {
        return file().getParent().resolve("configs");
    }

    /** Saves the settings under a name. */
    public static void saveAs(String name) throws java.io.IOException {
        Files.createDirectories(configsDir());
        Files.writeString(configsDir().resolve(name + ".json"), GSON.toJson(get()));
    }

    /** Loads settings saved under a name. */
    public static void load(String name) throws java.io.IOException {
        try (Reader r = Files.newBufferedReader(configsDir().resolve(name + ".json"))) {
            Data d = GSON.fromJson(r, Data.class);
            if (d != null) save(d);
        }
    }

    public static boolean night() {
        return get().night;
    }

    private static Path file() {
        return FabricLoader.getInstance().getGameDir().resolve("bi4visual").resolve("config.json");
    }

    /** Saves changes made in the game's Right Shift menu. */
    public static void save(Data data) {
        current = data;
        try {
            Path file = file();
            Files.createDirectories(file.getParent());
            Files.writeString(file, GSON.toJson(data));
            seenStamp = Files.getLastModifiedTime(file).toMillis();
        } catch (Exception ignored) {
            // Settings still apply until the game closes.
        }
    }

    private static void reload() {
        Path file = file();
        try {
            if (!Files.isRegularFile(file)) {
                return;
            }
            long stamp = Files.getLastModifiedTime(file).toMillis();
            if (stamp == seenStamp) {
                return;
            }
            try (Reader r = Files.newBufferedReader(file)) {
                Data next = GSON.fromJson(r, Data.class);
                if (next != null) {
                    current = next;
                }
            }
            seenStamp = stamp;
        } catch (Exception ignored) {
            // Keep the last good settings.
        }
    }
}
