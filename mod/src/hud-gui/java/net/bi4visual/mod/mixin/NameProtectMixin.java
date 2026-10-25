package net.bi4visual.mod.mixin;

import net.bi4visual.mod.Config;
import net.minecraft.client.Minecraft;
import net.minecraft.util.StringDecomposer;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.ModifyVariable;

/** NameProtect: the own nick is shown as "bi4visual" in every text on screen (chat, tab, HUD). */
@Mixin(StringDecomposer.class)
public abstract class NameProtectMixin {
    @ModifyVariable(method = "iterateFormatted(Ljava/lang/String;ILnet/minecraft/network/chat/Style;Lnet/minecraft/network/chat/Style;Lnet/minecraft/util/FormattedCharSink;)Z",
            at = @At("HEAD"), argsOnly = true, ordinal = 0, require = 0)
    private static String bi4visual$protect(String text) {
        if (text == null || text.isEmpty() || !Config.get().nameProtect) return text;
        String name = Minecraft.getInstance().getUser().getName();
        return name != null && name.length() > 2 && text.contains(name) ? text.replace(name, "bi4visual") : text;
    }
}
