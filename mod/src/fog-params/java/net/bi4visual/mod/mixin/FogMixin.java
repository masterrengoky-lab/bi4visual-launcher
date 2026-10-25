package net.bi4visual.mod.mixin;

import net.bi4visual.mod.Config;
import net.minecraft.client.renderer.FogParameters;
import net.minecraft.client.renderer.FogRenderer;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/** CustomFog (1.21.4–1.21.5): a closer fog tinted with the theme colour or a chosen one. */
@Mixin(FogRenderer.class)
public abstract class FogMixin {
    @Inject(method = "setupFog", at = @At("RETURN"), cancellable = true, require = 0)
    private static void bi4visual$fog(CallbackInfoReturnable<FogParameters> cir) {
        String mode = Config.get().fog;
        FogParameters f = cir.getReturnValue();
        if (mode == null || mode.equals("off") || f == null || f.end() <= 0) return;
        int rgb = switch (mode) {
            case "pink" -> 0xFFB0D0;
            case "sky" -> 0x9FD8FF;
            case "dark" -> 0x1A1626;
            default -> Config.accent() & 0xFFFFFF;
        };
        float end = f.end() * 0.75f;
        cir.setReturnValue(new FogParameters(end * 0.1f, end, f.shape(),
                ((rgb >> 16) & 0xFF) / 255f, ((rgb >> 8) & 0xFF) / 255f, (rgb & 0xFF) / 255f, f.alpha()));
    }
}
