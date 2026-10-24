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
        /** Main menu background tint (see MenuScreen.BACKGROUNDS) and how dark it is, 0–100. */
        public String menuBg = "forest";
        public int menuDim = 55;
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

    /** The periwinkle highlight used across the menus and the HUD. */
    public static int accent() {
        return 0xFF8597DC;
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
