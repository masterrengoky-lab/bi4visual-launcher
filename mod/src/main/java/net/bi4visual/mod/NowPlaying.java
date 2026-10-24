package net.bi4visual.mod;

import com.google.gson.Gson;
import java.io.Reader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import net.fabricmc.loader.api.FabricLoader;

/** Reads bi4visual/nowplaying.json, written by the launcher, on a background thread. */
public final class NowPlaying {
    public static final class Line {
        public long t;
        public String text = "";
    }

    public static final class Data {
        public String title = "";
        public String artist = "";
        public boolean playing;
        public long position_ms;
        public long updated_at_ms;
        public List<Line> lines = List.of();

        /** Where the song is now, in milliseconds. */
        public long position(long now) {
            return playing ? position_ms + Math.max(0, now - updated_at_ms) : position_ms;
        }
    }

    private static final Gson GSON = new Gson();
    private static volatile Data current;

    private NowPlaying() {}

    public static Data get() {
        return current;
    }

    static void start() {
        Thread t = new Thread(NowPlaying::loop, "bi4visual-nowplaying");
        t.setDaemon(true);
        t.start();
    }

    private static void loop() {
        Path file = FabricLoader.getInstance().getGameDir().resolve("bi4visual").resolve("nowplaying.json");
        String seen = "";
        while (true) {
            try {
                if (Files.isRegularFile(file)) {
                    String stamp = Files.getLastModifiedTime(file).toMillis() + ":" + Files.size(file);
                    if (!stamp.equals(seen)) {
                        try (Reader r = Files.newBufferedReader(file)) {
                            Data next = GSON.fromJson(r, Data.class);
                            Data prev = current;
                            if (next != null && (prev == null || !next.title.equals(prev.title))) {
                                System.out.println("[bi4visual] Вижу трек: " + next.artist + " - " + next.title + ", строк текста: " + (next.lines == null ? 0 : next.lines.size()));
                            }
                            current = next;
                        }
                        seen = stamp;
                    }
                } else {
                    current = null;
                    seen = "";
                }
            } catch (Exception ignored) {
                // The launcher may be replacing the file right now; try again next round.
            }
            try {
                Thread.sleep(200);
            } catch (InterruptedException e) {
                return;
            }
        }
    }
}
