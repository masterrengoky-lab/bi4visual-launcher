package net.bi4visual.mod.mixin;

import net.bi4visual.mod.Config;
import net.minecraft.client.renderer.GameRenderer;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.ModifyArg;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** NoRender (no hurt shake) and AspectRatio (a stretched picture). Only the own view. */
@Mixin(GameRenderer.class)
public abstract class ViewMixin {
    @Inject(method = "bobHurt", at = @At("HEAD"), cancellable = true, require = 0)
    private void bi4visual$noShake(CallbackInfo ci) {
        if (Config.get().noHurtShake) ci.cancel();
    }

    @ModifyArg(method = "getProjectionMatrix", require = 0, index = 1,
            at = @At(value = "INVOKE", target = "Lorg/joml/Matrix4f;perspective(FFFF)Lorg/joml/Matrix4f;"))
    private float bi4visual$aspect(float aspect) {
        return switch (Config.get().aspect) {
            case "4:3" -> 4f / 3f;
            case "5:4" -> 5f / 4f;
            case "16:10" -> 16f / 10f;
            default -> aspect;
        };
    }
}
