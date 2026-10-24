package net.bi4visual.mod;

import net.fabricmc.api.ClientModInitializer;

public final class Bi4visualClient implements ClientModInitializer {
    @Override
    public void onInitializeClient() {
        NowPlaying.start();
        // The in-game modules exist only in the 1.21.x builds.
        try {
            Class.forName("net.bi4visual.mod.Modules").getMethod("init").invoke(null);
        } catch (ReflectiveOperationException | LinkageError ignored) {
            // 26.x: lyrics and sky only.
        }
        System.out.println("[bi4visual] Мод текста песен загружен, жду bi4visual/nowplaying.json");
    }
}
