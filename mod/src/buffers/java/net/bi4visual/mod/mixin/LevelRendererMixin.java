package net.bi4visual.mod.mixin;

import net.bi4visual.mod.Lyrics3D;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.Font;
import net.minecraft.client.renderer.LevelRenderer;
import net.minecraft.client.renderer.MultiBufferSource;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/**
 * Up to 26.1: draws the lyrics into the immediate buffers after the world,
 * so they stay visible with the HUD hidden (F1).
 */
@Mixin(LevelRenderer.class)
public class LevelRendererMixin {
    @Inject(method = "renderLevel", at = @At("TAIL"), require = 0)
    private void bi4visual$lyrics(CallbackInfo ci) {
        Minecraft mc = Minecraft.getInstance();
        MultiBufferSource.BufferSource buffers = mc.renderBuffers().bufferSource();
        boolean drawn = Lyrics3D.render((pose, letter, x, y, argb, shadow) -> mc.font.drawInBatch(letter, x, y, argb, shadow,
                pose.last().pose(), buffers, Font.DisplayMode.SEE_THROUGH, 0, Lyrics3D.FULL_BRIGHT), true);
        if (drawn) {
            buffers.endBatch();
        }
    }
}
