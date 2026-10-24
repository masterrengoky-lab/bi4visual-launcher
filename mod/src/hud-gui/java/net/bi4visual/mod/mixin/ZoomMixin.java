package net.bi4visual.mod.mixin;

import net.bi4visual.mod.Modules;
import net.minecraft.client.renderer.GameRenderer;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/** Zoom: a quarter of the field of view while the zoom key is held. */
@Mixin(GameRenderer.class)
public class ZoomMixin {
    @Inject(method = "getFov", at = @At("RETURN"), cancellable = true, require = 0)
    private void bi4visual$zoom(CallbackInfoReturnable<Object> cir) {
        if (!Modules.zooming()) return;
        Object fov = cir.getReturnValue();
        if (fov instanceof Float f) cir.setReturnValue(f / 4f);
        else if (fov instanceof Double d) cir.setReturnValue(d / 4d);
    }
}
