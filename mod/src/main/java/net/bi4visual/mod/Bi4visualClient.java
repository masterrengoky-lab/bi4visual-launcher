package net.bi4visual.mod;

import net.fabricmc.api.ClientModInitializer;

public final class Bi4visualClient implements ClientModInitializer {
    @Override
    public void onInitializeClient() {
        NowPlaying.start();
    }
}
