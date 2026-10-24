package net.bi4visual.mod.mixin;

import net.minecraft.client.gui.Gui;
import org.spongepowered.asm.mixin.Mixin;

/** 26.x builds its HUD from render state; our HUD is not there yet. */
@Mixin(Gui.class)
public class GuiMixin {}
