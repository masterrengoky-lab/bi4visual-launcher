package net.bi4visual.mod.mixin;

import net.bi4visual.mod.FreeLook;
import net.minecraft.client.Camera;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.ModifyArg;

/** FreeLook: the camera takes the free angles instead of the player's. */
@Mixin(Camera.class)
public abstract class FreeCameraMixin {
    @ModifyArg(method = "setup", require = 0, index = 0,
            at = @At(value = "INVOKE", target = "Lnet/minecraft/client/Camera;setRotation(FF)V"))
    private float bi4visual$yaw(float yaw) {
        return FreeLook.active() ? FreeLook.yaw : yaw;
    }

    @ModifyArg(method = "setup", require = 0, index = 1,
            at = @At(value = "INVOKE", target = "Lnet/minecraft/client/Camera;setRotation(FF)V"))
    private float bi4visual$pitch(float pitch) {
        return FreeLook.active() ? FreeLook.pitch : pitch;
    }
}
