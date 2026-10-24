package net.bi4visual.mod;

import net.minecraft.network.chat.Component;
import net.minecraft.network.chat.Style;
import net.minecraft.network.chat.FontDescription;
import net.minecraft.resources.ResourceLocation;

/** 1.21.9–1.21.10: fonts are a FontDescription wrapping a ResourceLocation. */
public final class Fonts {
    private static final Style LYRICS = Style.EMPTY.withFont(
            new FontDescription.Resource(ResourceLocation.fromNamespaceAndPath("bi4visual", "lyrics")));
    private static final Style SKY = Style.EMPTY.withFont(
            new FontDescription.Resource(ResourceLocation.fromNamespaceAndPath("bi4visual", "sky")));
    private static final Style FX = Style.EMPTY.withFont(
            new FontDescription.Resource(ResourceLocation.fromNamespaceAndPath("bi4visual", "fx")));
    private static final Style HUD = Style.EMPTY.withFont(
            new FontDescription.Resource(ResourceLocation.fromNamespaceAndPath("bi4visual", "hud")));
    private static final Style HUD_TITLE = Style.EMPTY.withFont(
            new FontDescription.Resource(ResourceLocation.fromNamespaceAndPath("bi4visual", "hud_title")));
    private static final Style HUD_SMALL = Style.EMPTY.withFont(
            new FontDescription.Resource(ResourceLocation.fromNamespaceAndPath("bi4visual", "hud_small")));

    private Fonts() {}

    /** Text in the HUD font (assets/bi4visual/font/hud.json). */
    public static Component hud(String text) {
        return Component.literal(text).withStyle(HUD);
    }

    /** Large text for menu titles (assets/bi4visual/font/hud_title.json). */
    public static Component title(String text) {
        return Component.literal(text).withStyle(HUD_TITLE);
    }

    /** Small text for captions (assets/bi4visual/font/hud_small.json). */
    public static Component small(String text) {
        return Component.literal(text).withStyle(HUD_SMALL);
    }

    /** A ring (\ue030) or a soft dot (\ue031) for effects in the world (assets/bi4visual/font/fx.json). */
    public static Component fx(char glyph) {
        return Component.literal(String.valueOf(glyph)).withStyle(FX);
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
