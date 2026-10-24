package net.bi4visual.mod.mixin;

import net.minecraft.client.renderer.SkyRenderer;
import org.spongepowered.asm.mixin.Mixin;

/** From 1.21.9 the sky pass has no buffer source to draw text into; the custom sky is not there yet. */
@Mixin(SkyRenderer.class)
public class SkyRendererMixin {
}
