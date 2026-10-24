package net.bi4visual.mod.mixin;

import net.bi4visual.mod.Lyrics3D;
import net.minecraft.client.gui.Font;
import net.minecraft.client.renderer.LevelRenderer;
import net.minecraft.client.renderer.SubmitNodeCollector;
import net.minecraft.client.renderer.state.level.LevelRenderState;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/**
 * From 26.2 the world is drawn from submitted nodes: hand the letters to the
 * collector with the rest of the world, so they stay visible with F1 too.
 */
@Mixin(LevelRenderer.class)
public class LevelRendererMixin {
    @Inject(method = "submitFeatures", at = @At("TAIL"))
    private void bi4visual$lyrics(LevelRenderState state, SubmitNodeCollector collector, boolean outlines, CallbackInfo ci) {
        Lyrics3D.render((pose, letter, x, y, argb) -> collector.submitText(pose, x, y, letter.getVisualOrderText(), true,
                Font.DisplayMode.SEE_THROUGH, Lyrics3D.FULL_BRIGHT, argb, 0, 0), false);
    }
}
