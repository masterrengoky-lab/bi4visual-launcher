package net.bi4visual.mod.mixin;

import net.minecraft.client.Minecraft;
import org.spongepowered.asm.mixin.Mixin;

/** 1.21.9 and newer draw the held item through the submit pipeline; HMI is not there yet. */
@Mixin(Minecraft.class)
public class ItemHandMixin {
}
