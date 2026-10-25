package net.bi4visual.mod.mixin;

import net.bi4visual.mod.Config;
import net.minecraft.client.player.LocalPlayer;
import net.minecraft.world.entity.LivingEntity;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/** SwingAnimation: the own arm swings slower. Only the animation; hits are not changed. */
@Mixin(LivingEntity.class)
public abstract class SwingMixin {
    @Inject(method = "getCurrentSwingDuration", at = @At("RETURN"), cancellable = true, require = 0)
    private void bi4visual$slow(CallbackInfoReturnable<Integer> cir) {
        if (!((Object) this instanceof LocalPlayer)) return;
        switch (Config.get().swing) {
            case "slow" -> cir.setReturnValue(cir.getReturnValue() * 2);
            case "slower" -> cir.setReturnValue(cir.getReturnValue() * 3);
            default -> {
            }
        }
    }
}
