package net.bi4visual.mod;

import net.minecraft.network.chat.Component;
import net.minecraft.network.chat.Style;
import net.minecraft.resources.ResourceLocation;

/** 1.21.4–1.21.8: fonts are picked by a ResourceLocation. */
public final class Fonts {
    private static final Style LYRICS = Style.EMPTY.withFont(ResourceLocation.fromNamespaceAndPath("bi4visual", "lyrics"));

    private Fonts() {}

    /** One letter in the smooth lyrics font (assets/bi4visual/font/lyrics.json). */
    public static Component letter(String text) {
        return Component.literal(text).withStyle(LYRICS);
    }
}
