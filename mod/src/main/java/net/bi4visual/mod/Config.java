package net.bi4visual.mod;

import com.google.gson.Gson;
import java.io.Reader;
import java.nio.file.Files;
import java.nio.file.Path;
import net.fabricmc.loader.api.FabricLoader;

/** Visual settings from the launcher (bi4visual/config.json), re-read when the file changes. */
public final class Config {
    public static final class Data {
        /** "galaxy", "aurora", "both" or "off". */
        public String sky = "galaxy";
        /** Keep the client at midnight. */
        public boolean night = true;
    }

    private static final Gson GSON = new Gson();
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

    public static boolean night() {
        return get().night;
    }

    private static void reload() {
        Path file = FabricLoader.getInstance().getGameDir().resolve("bi4visual").resolve("config.json");
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
