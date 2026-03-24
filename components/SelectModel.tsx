import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dispatch, SetStateAction } from "react";

interface SelectModelProps {
  list: string[];
  setModel: Dispatch<SetStateAction<string>>;
  model: string;
}

const SelectModel = ({ list, setModel, model }: SelectModelProps) => {
  return (
    <Select onValueChange={(value) => setModel(value)} value={model}>
      <SelectTrigger className="w-45">
        <SelectValue placeholder="minimax-m2.7:cloud" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {list.map((item) => (
            <SelectItem key={item} value={item}>
              {item}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
};

export default SelectModel;
