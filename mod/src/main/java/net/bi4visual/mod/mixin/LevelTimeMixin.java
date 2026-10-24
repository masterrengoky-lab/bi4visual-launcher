package net.bi4visual.mod.mixin;

import net.bi4visual.mod.Config;
import net.minecraft.client.multiplayer.ClientLevel;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/**
 * "Always night": the client's own copy of the world time stays at midnight,
 * which the sky colour and light are worked out from. The server is not touched.
 */
@Mixin(ClientLevel.ClientLevelData.class)
public abstract class LevelTimeMixin {
    @Inject(method = "getDayTime", at = @At("HEAD"), cancellable = true, require = 0)
    private void bi4visual$night(CallbackInfoReturnable<Long> cir) {
        if (Config.night()) {
            cir.setReturnValue(18000L);
        }
    }
}
