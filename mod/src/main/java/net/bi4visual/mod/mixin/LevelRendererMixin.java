package net.bi4visual.mod.mixin;

import net.bi4visual.mod.Lyrics3D;
import net.minecraft.client.renderer.LevelRenderer;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Draws the lyrics after the world, so they stay visible with the HUD hidden (F1). */
@Mixin(LevelRenderer.class)
public class LevelRendererMixin {
    @Inject(method = "renderLevel", at = @At("TAIL"))
    private void bi4visual$lyrics(CallbackInfo ci) {
        Lyrics3D.render();
    }
}
