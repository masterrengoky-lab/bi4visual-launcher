package net.bi4visual.mod;

import net.fabricmc.api.ClientModInitializer;

public final class Bi4visualClient implements ClientModInitializer {
    @Override
    public void onInitializeClient() {
        NowPlaying.start();
        System.out.println("[bi4visual] Мод текста песен загружен, жду bi4visual/nowplaying.json");
    }
}
