package net.bi4visual.mod.mixin;

import net.bi4visual.mod.Config;
import net.minecraft.world.item.ItemStack;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/** HandShader: the item in the first-person hand always gets the shimmering glint. */
@Mixin(ItemStack.class)
public class FoilMixin {
    @Inject(method = "hasFoil", at = @At("HEAD"), cancellable = true, require = 0)
    private void bi4visual$shimmer(CallbackInfoReturnable<Boolean> cir) {
        if (Config.drawingHand) cir.setReturnValue(true);
    }
}
