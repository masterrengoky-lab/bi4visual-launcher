package net.bi4visual.mod;

import net.minecraft.network.chat.Component;
import net.minecraft.network.chat.Style;
import net.minecraft.network.chat.FontDescription;
import net.minecraft.resources.Identifier;

/** 1.21.11 on: ResourceLocation is called Identifier. */
public final class Fonts {
    private static final Style LYRICS = Style.EMPTY.withFont(
            new FontDescription.Resource(Identifier.fromNamespaceAndPath("bi4visual", "lyrics")));
    private static final Style SKY = Style.EMPTY.withFont(
            new FontDescription.Resource(Identifier.fromNamespaceAndPath("bi4visual", "sky")));
    private static final Style HUD = Style.EMPTY.withFont(
            new FontDescription.Resource(Identifier.fromNamespaceAndPath("bi4visual", "hud")));

    private Fonts() {}

    /** Text in the HUD font (assets/bi4visual/font/hud.json). */
    public static Component hud(String text) {
        return Component.literal(text).withStyle(HUD);
    }

    /** One tile of the sky pictures (assets/bi4visual/font/sky.json). */
    public static Component sky(char tile) {
        return Component.literal(String.valueOf(tile)).withStyle(SKY);
    }

    /** One letter in the smooth lyrics font (assets/bi4visual/font/lyrics.json). */
    public static Component letter(String text) {
        return Component.literal(text).withStyle(LYRICS);
    }
}
