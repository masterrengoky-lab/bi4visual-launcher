package net.bi4visual.mod.mixin;

import net.bi4visual.mod.Config;
import net.minecraft.client.multiplayer.ClientLevel;
import net.minecraft.world.level.Level;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/** Ambience weather: the client's world says it is clear, raining or storming. The server is not touched. */
@Mixin(Level.class)
public abstract class WeatherMixin {
    @Inject(method = "getRainLevel", at = @At("HEAD"), cancellable = true, require = 0)
    private void bi4visual$rain(float partial, CallbackInfoReturnable<Float> cir) {
        if (!((Object) this instanceof ClientLevel)) return;
        switch (weather()) {
            case "clear" -> cir.setReturnValue(0f);
            case "rain", "thunder" -> cir.setReturnValue(1f);
            default -> {
            }
        }
    }

    @Inject(method = "getThunderLevel", at = @At("HEAD"), cancellable = true, require = 0)
    private void bi4visual$thunder(float partial, CallbackInfoReturnable<Float> cir) {
        if (!((Object) this instanceof ClientLevel)) return;
        switch (weather()) {
            case "clear", "rain" -> cir.setReturnValue(0f);
            case "thunder" -> cir.setReturnValue(1f);
            default -> {
            }
        }
    }

    private static String weather() {
        String w = Config.get().weather;
        return w == null ? "off" : w;
    }
}
