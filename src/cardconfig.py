from dataclasses import dataclass
import math

@dataclass
class CardConfig:
    """Units in this card are in meters"""
    #card_width: float = 0.2100
    #card_height: float = 0.1485

    card_width: float = 0.148
    card_height: float = 0.105

    spacing: float = 0.001
    dpi: int = 300

    @classmethod
    def calc_grid_size(cls, number_activities: int):    
        ratio = cls.card_width / cls.card_height
        ncol = math.ceil(math.sqrt(ratio * number_activities))
        nrow = math.ceil(number_activities / ncol)

        while nrow * ncol < number_activities:
            ncol += 1
            nrow = math.ceil(number_activities / ncol)

        return nrow, ncol
