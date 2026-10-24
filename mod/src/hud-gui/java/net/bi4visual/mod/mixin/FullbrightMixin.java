package net.bi4visual.mod.mixin;

import net.bi4visual.mod.Config;
import net.minecraft.client.Minecraft;
import net.minecraft.client.OptionInstance;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/** FullBright: the brightness setting reads far above its slider's maximum. */
@Mixin(OptionInstance.class)
public class FullbrightMixin {
    @Inject(method = "get", at = @At("HEAD"), cancellable = true, require = 0)
    private void bi4visual$bright(CallbackInfoReturnable<Object> cir) {
        Minecraft mc = Minecraft.getInstance();
        if (mc != null && mc.options != null && (Object) this == mc.options.gamma() && Config.get().fullbright) {
            cir.setReturnValue(12.0);
        }
    }
}
