package net.bi4visual.mod.mixin;

import net.bi4visual.mod.Config;
import net.bi4visual.mod.MenuScreen;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.gui.screens.TitleScreen;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.ModifyVariable;

/** Shows the bi4visual main menu wherever the game would open its title screen. */
@Mixin(Minecraft.class)
public class TitleScreenMixin {
    @ModifyVariable(method = "setScreen", at = @At("HEAD"), argsOnly = true, require = 0)
    private Screen bi4visual$menu(Screen screen) {
        if (screen instanceof TitleScreen && Config.get().menu && !MenuScreen.vanillaOnce()) {
            return new MenuScreen();
        }
        return screen;
    }
}
