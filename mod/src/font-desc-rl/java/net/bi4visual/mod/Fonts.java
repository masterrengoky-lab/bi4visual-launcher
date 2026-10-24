package net.bi4visual.mod;

import net.minecraft.network.chat.Component;
import net.minecraft.network.chat.Style;
import net.minecraft.network.chat.FontDescription;
import net.minecraft.resources.ResourceLocation;

/** 1.21.9–1.21.10: fonts are a FontDescription wrapping a ResourceLocation. */
public final class Fonts {
    private static final Style LYRICS = Style.EMPTY.withFont(
            new FontDescription.Resource(ResourceLocation.fromNamespaceAndPath("bi4visual", "lyrics")));

    private Fonts() {}

    /** One letter in the smooth lyrics font (assets/bi4visual/font/lyrics.json). */
    public static Component letter(String text) {
        return Component.literal(text).withStyle(LYRICS);
    }
}
