package net.bi4visual.mod.mixin;

import net.bi4visual.mod.Smooth;
import net.minecraft.client.gui.font.FontTexture;
import net.minecraft.client.renderer.texture.AbstractTexture;
import net.minecraft.client.renderer.texture.TextureManager;
import net.minecraft.resources.ResourceLocation;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Smooth filtering for the lyrics and HUD fonts; the sky tiles keep sharp edges so no seams show between them. */
@Mixin(TextureManager.class)
public class FontFilterMixin {
    @Inject(method = "register(Lnet/minecraft/resources/ResourceLocation;Lnet/minecraft/client/renderer/texture/AbstractTexture;)V",
            at = @At("TAIL"), require = 0)
    private void bi4visual$smooth(ResourceLocation name, AbstractTexture texture, CallbackInfo ci) {
        if (texture instanceof FontTexture && "bi4visual".equals(name.getNamespace()) && (name.getPath().startsWith("lyrics") || name.getPath().startsWith("hud") || name.getPath().startsWith("fx"))) {
            Smooth.linear(texture);
        }
    }
}
