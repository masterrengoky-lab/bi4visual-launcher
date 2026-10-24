package net.bi4visual.mod.mixin;

import net.minecraft.client.Minecraft;
import org.spongepowered.asm.mixin.Mixin;

/** 1.21.9 and newer draw the hand through the submit pipeline; HandGlow is not there yet. */
@Mixin(Minecraft.class)
public class HandMixin {
}
