package net.bi4visual.mod.mixin;

import net.bi4visual.mod.Config;
import net.bi4visual.mod.Modules;
import net.minecraft.client.multiplayer.ClientPacketListener;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** CommandFix: ".рщьу" (typed in the Russian layout) is sent as the command "/home". */
@Mixin(ClientPacketListener.class)
public class ChatMixin {
    @Inject(method = "sendChat", at = @At("HEAD"), cancellable = true, require = 0)
    private void bi4visual$commandFix(String message, CallbackInfo ci) {
        if (!Config.get().commandFix) return;
        String command = Modules.fixCommand(message);
        if (command != null) {
            ci.cancel();
            ((ClientPacketListener) (Object) this).sendCommand(command);
        }
    }
}
