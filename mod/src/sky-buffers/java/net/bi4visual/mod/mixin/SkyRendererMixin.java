package net.bi4visual.mod.mixin;

import com.llamalad7.mixinextras.sugar.Local;
import com.mojang.blaze3d.vertex.PoseStack;
import net.bi4visual.mod.Lyrics3D;
import net.bi4visual.mod.Sky3D;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.Font;
import net.minecraft.client.renderer.MultiBufferSource;
import net.minecraft.client.renderer.SkyRenderer;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/**
 * 1.21.4–1.21.8: the sky pass hands sun, moon and stars a buffer source; our
 * galaxy goes in first, flushed right away so the terrain is drawn over it.
 */
@Mixin(SkyRenderer.class)
public class SkyRendererMixin {
    @Inject(method = "renderSunMoonAndStars", at = @At("HEAD"), require = 0)
    private void bi4visual$sky(CallbackInfo ci, @Local(argsOnly = true) PoseStack pose,
                               @Local(argsOnly = true) MultiBufferSource.BufferSource buffers) {
        Minecraft mc = Minecraft.getInstance();
        if (mc.level == null) {
            return;
        }
        // Only at night, like the stars: hidden in daylight and in rain.
        float visibility = Math.min(1f, mc.level.getStarBrightness(1f) * 2f) * (1f - mc.level.getRainLevel(1f));
        Font font = mc.font;
        Lyrics3D.Sink sink = (p, glyph, x, y, argb, shadow) -> font.drawInBatch(glyph, x, y, argb, false,
                p.last().pose(), buffers, Font.DisplayMode.SEE_THROUGH, 0, Lyrics3D.FULL_BRIGHT);
        if (Sky3D.render(sink, pose, visibility)) {
            buffers.endBatch();
        }
    }
}
