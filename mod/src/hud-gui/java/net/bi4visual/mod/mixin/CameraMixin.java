package net.bi4visual.mod.mixin;

import net.bi4visual.mod.Anim;
import net.bi4visual.mod.Config;
import net.minecraft.client.Camera;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.ModifyVariable;

/** BetterMinecraft: the third person camera slides out from the head instead of jumping. */
@Mixin(Camera.class)
public abstract class CameraMixin {
    @Shadow public abstract boolean isDetached();

    @ModifyVariable(method = "getMaxZoom", at = @At("HEAD"), argsOnly = true, require = 0)
    private float bi4visual$slide(float distance) {
        float p = Anim.cameraProgress(isDetached());
        return Config.get().better ? distance * p : distance;
    }
}
