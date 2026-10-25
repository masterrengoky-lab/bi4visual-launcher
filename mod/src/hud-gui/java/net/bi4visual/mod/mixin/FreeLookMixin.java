package net.bi4visual.mod.mixin;

import net.bi4visual.mod.FreeLook;
import net.minecraft.client.Minecraft;
import net.minecraft.world.entity.Entity;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** FreeLook: mouse turns go to the free camera instead of the player. */
@Mixin(Entity.class)
public abstract class FreeLookMixin {
    @Inject(method = "turn", at = @At("HEAD"), cancellable = true, require = 0)
    private void bi4visual$look(double dx, double dy, CallbackInfo ci) {
        if (FreeLook.active() && (Object) this == Minecraft.getInstance().player) {
            FreeLook.turn(dx, dy);
            ci.cancel();
        }
    }
}
